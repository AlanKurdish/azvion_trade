import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WsGateway } from '../websocket/websocket.gateway';
import { v4 as uuidv4 } from 'uuid';

export interface MtTradeResult {
  orderId: string;
  positionId: string;
  openPrice: number;
  closePrice: number;
  profit: number;
}

export interface MtSymbol {
  symbol: string;
  description: string;
  digits: number;
}

@Injectable()
export class MetatraderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetatraderService.name);
  private bridgeUrl: string;
  private connected = false;
  private priceWs: WebSocket | null = null;
  private positionPollTimer: NodeJS.Timeout | null = null;

  // Formula cache: mtSymbol -> Array<{ symbolId, formula }>
  private formulaCache: Map<string, Array<{ symbolId: string; formula: string }>> = new Map();

  // Cached id of the lazily-created `__system__` user used to attribute
  // adopted orphan trades. Resolved once per process.
  private systemUserId: string | null = null;

  // First time (epoch ms) we observed each orphan MT5 ticket. Used to wait
  // out the brief window between a successful MT5 order_send and the
  // matching DB insert in the normal /trades/open flow before adopting.
  private firstSeenOrphan: Map<string, number> = new Map();

  /** How long an orphan must be visible in MT5 before reconciliation
   *  adopts it into the DB. Long enough to let /trades/open complete. */
  private static readonly ORPHAN_ADOPT_DELAY_MS = 10_000;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private wsGateway: WsGateway,
  ) {
    this.bridgeUrl = this.configService.get<string>(
      'MT5_BRIDGE_URL',
      'http://127.0.0.1:8010',
    );
  }

  async onModuleInit() {
    const mode = this.configService.get<string>('MT_BRIDGE_MODE', 'mock');
    if (mode === 'mt5') {
      await this.checkAndConnect();
    } else {
      this.logger.log(
        'MetaTrader running in MOCK mode (set MT_BRIDGE_MODE=mt5 to connect)',
      );
    }
  }

  async onModuleDestroy() {
    this.disconnectPriceStream();
    this.stopPositionPolling();
  }

  private async checkAndConnect() {
    try {
      const status = await this.callBridge<any>('GET', '/status');
      this.connected = status.connected;
      if (this.connected) {
        this.logger.log(
          `MT5 Bridge connected: login=${status.login} server=${status.server}`,
        );
        await this.connectPriceStream();
        this.startPositionPolling();
        await this.prisma.mtAccount.upsert({
          where: { accountId: 'mt5-direct' },
          update: {
            isConnected: true,
            login: String(status.login),
            brokerServer: status.server,
          },
          create: {
            accountId: 'mt5-direct',
            isConnected: true,
            platform: 'mt5',
            login: String(status.login),
            brokerServer: status.server,
          },
        });
      } else {
        this.scheduleBridgeRetry();
      }
    } catch {
      this.logger.warn(
        'MT5 Bridge not reachable. Retrying in 5s...',
      );
      this.scheduleBridgeRetry();
    }
  }

  /** Keep retrying until the bridge comes up (e.g. bridge starts after backend). */
  private scheduleBridgeRetry() {
    if (this.priceWs) return; // already connected via another path
    setTimeout(() => {
      if (!this.priceWs || (this.priceWs as WebSocket).readyState !== WebSocket.OPEN) {
        this.checkAndConnect();
      }
    }, 5000);
  }

  // --- Price WebSocket ---

  private async connectPriceStream() {
    const wsUrl = this.bridgeUrl.replace('http', 'ws') + '/ws/prices';

    try {
      this.priceWs = new WebSocket(wsUrl);

      this.priceWs.onopen = () => {
        this.logger.log('Price stream connected');
        this.refreshFormulaCache();
        this.subscribeToTradableSymbols();
        this.subscribeToOpenPositions();
      };

      this.priceWs.onmessage = (event: any) => {
        try {
          const msg = JSON.parse(
            typeof event.data === 'string'
              ? event.data
              : event.data.toString(),
          );
          if (msg.type === 'prices') {
            this.handlePriceUpdate(msg.data);
          } else if (msg.type === 'positions') {
            this.handlePositionUpdate(msg.data);
          }
        } catch {
          // ignore parse errors
        }
      };

      this.priceWs.onclose = () => {
        this.logger.warn('Price stream disconnected, reconnecting in 5s...');
        setTimeout(() => this.connectPriceStream(), 5000);
      };

      this.priceWs.onerror = () => {
        // onclose will fire after this
      };
    } catch (error) {
      this.logger.error('Failed to connect price stream', error);
    }
  }

  private disconnectPriceStream() {
    if (this.priceWs) {
      this.priceWs.close();
      this.priceWs = null;
    }
  }

  /**
   * Refresh the formula cache from the database.
   * Called on startup and whenever symbols are created/updated.
   */
  async refreshFormulaCache() {
    const symbols = await this.prisma.symbol.findMany({
      where: { isTradable: true, isDeleted: false, formula: { not: null } },
      select: { id: true, mtSymbol: true, formula: true },
    });

    this.formulaCache.clear();
    for (const s of symbols) {
      if (!s.formula) continue;
      const list = this.formulaCache.get(s.mtSymbol) || [];
      list.push({ symbolId: s.id, formula: s.formula });
      this.formulaCache.set(s.mtSymbol, list);
    }
    this.logger.log(`Formula cache refreshed: ${symbols.length} formulas loaded`);
  }

  /**
   * Safely evaluate a price formula. Variables: ask, bid.
   * Example formula: "(ask*2/3.1)" or "ask*0.97" or "(bid+ask)/2*1000"
   */
  private evaluateFormula(formula: string, bid: number, ask: number): number | null {
    try {
      // Only allow: numbers, operators, parentheses, dots, spaces, and the words 'ask'/'bid'
      const sanitized = formula.replace(/\s/g, '');
      if (!/^[0-9+\-*/().askbid]+$/i.test(sanitized)) {
        this.logger.warn(`Invalid formula rejected: ${formula}`);
        return null;
      }

      // Replace ask/bid with values (case-insensitive)
      const expr = sanitized
        .replace(/ask/gi, String(ask))
        .replace(/bid/gi, String(bid));

      // Evaluate using Function (safe since we validated the chars)
      const result = new Function(`return (${expr})`)();
      if (typeof result !== 'number' || !isFinite(result)) return null;
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Subscribe all tradable symbols to the bridge WS for price streaming.
   * Public so it can be called when symbols are added/updated.
   */
  async subscribeToTradableSymbols() {
    if (!this.priceWs || this.priceWs.readyState !== WebSocket.OPEN) return;

    const symbols = await this.prisma.symbol.findMany({
      where: { isTradable: true, isDeleted: false },
      select: { mtSymbol: true },
    });

    const symbolNames = [...new Set(symbols.map((s) => s.mtSymbol))];
    if (symbolNames.length > 0) {
      this.priceWs.send(
        JSON.stringify({ action: 'subscribe', symbols: symbolNames }),
      );
      this.logger.log(`Subscribed to prices: ${symbolNames.join(', ')}`);
    }
  }

  /**
   * Subscribe the bridge WS to stream position updates for all open trades.
   */
  private async subscribeToOpenPositions() {
    if (!this.priceWs || this.priceWs.readyState !== WebSocket.OPEN) return;

    const openTrades = await this.prisma.trade.findMany({
      where: { status: 'OPEN', mtOrderId: { not: null } },
      select: { mtOrderId: true },
    });

    const tickets = openTrades
      .map((t) => t.mtOrderId)
      .filter((id): id is string => !!id && !id.startsWith('mock-'));

    if (tickets.length > 0) {
      this.priceWs.send(
        JSON.stringify({ action: 'subscribe_positions', tickets }),
      );
      this.logger.log(
        `Subscribed to ${tickets.length} position updates from MT5`,
      );
    }
  }

  /**
   * Subscribe a single new position ticket to the bridge WS.
   */
  subscribePositionTicket(ticket: string) {
    if (
      !this.priceWs ||
      this.priceWs.readyState !== WebSocket.OPEN ||
      ticket.startsWith('mock-')
    )
      return;
    this.priceWs.send(
      JSON.stringify({ action: 'subscribe_positions', tickets: [ticket] }),
    );
  }

  /**
   * Unsubscribe a position ticket from the bridge WS.
   */
  unsubscribePositionTicket(ticket: string) {
    if (!this.priceWs || this.priceWs.readyState !== WebSocket.OPEN) return;
    this.priceWs.send(
      JSON.stringify({
        action: 'unsubscribe_positions',
        tickets: [ticket],
      }),
    );
  }

  private async handlePriceUpdate(
    prices: Array<{
      symbol: string;
      bid: number;
      ask: number;
      time: number;
      trade_mode?: number;
    }>,
  ) {
    // Build user price data with formula results
    const userPrices: any[] = [];

    for (const price of prices) {
      const tradeMode = price.trade_mode ?? 4;
      const formulas = this.formulaCache.get(price.symbol);

      if (formulas && formulas.length > 0) {
        // Symbol has formula(s) — compute and send formulaPrice per symbol ID
        for (const f of formulas) {
          const formulaPrice = this.evaluateFormula(f.formula, price.bid, price.ask);
          const priceData = {
            symbol: price.symbol,
            symbolId: f.symbolId,
            formulaPrice: formulaPrice,
            timestamp: price.time,
            tradeMode,
          };
          this.wsGateway.emitPriceUpdate(price.symbol, priceData);
          userPrices.push(priceData);
        }
      } else {
        // No formula — send formulaPrice as ask price (always send formulaPrice)
        const priceData = {
          symbol: price.symbol,
          formulaPrice: price.ask,
          timestamp: price.time,
          tradeMode,
        };
        this.wsGateway.emitPriceUpdate(price.symbol, priceData);
        userPrices.push(priceData);
      }
    }

    // Broadcast to ALL user clients
    this.wsGateway.broadcastToAll('price:update:all', userPrices);

    // Admin always gets raw bid/ask (no formula applied)
    this.wsGateway.emitAdminPriceUpdate(
      prices.map((p) => ({
        symbol: p.symbol,
        bid: p.bid,
        ask: p.ask,
        time: p.time,
        tradeMode: p.trade_mode ?? 4,
      })),
    );
  }

  /**
   * Handle real MT5 position updates — stream actual profit to users.
   */
  private async handlePositionUpdate(
    positions: Array<{
      ticket: string;
      status?: string;
      profit?: number;
      current_price?: number;
      swap?: number;
      symbol?: string;
      open_price?: number;
    }>,
  ) {
    for (const pos of positions) {
      try {
        const trade = await this.prisma.trade.findFirst({
          where: { mtOrderId: pos.ticket, status: 'OPEN' },
          select: { id: true, userId: true },
        });

        if (!trade) continue;

        if (pos.status === 'CLOSED') {
          this.wsGateway.emitTradePnl(trade.id, {
            tradeId: trade.id,
            currentPrice: 0,
            unrealizedPnl: 0,
            mtProfit: 0,
            status: 'CLOSED_ON_MT5',
            timestamp: Date.now(),
          });
          continue;
        }

        // Stream real MT5 profit to both trade room and user room
        const pnlData = {
          tradeId: trade.id,
          currentPrice: pos.current_price ?? 0,
          unrealizedPnl: pos.profit ?? 0,
          mtProfit: pos.profit ?? 0,
          swap: pos.swap ?? 0,
          openPrice: pos.open_price,
          timestamp: Date.now(),
        };
        this.wsGateway.emitTradePnl(trade.id, pnlData);
        this.wsGateway.emitToUser(trade.userId, 'trade:pnl', pnlData);
        this.wsGateway.emitAdminTradePnl(pnlData);
      } catch {
        // Silently handle DB lookup errors
      }
    }
  }

  // --- Position Polling (fallback + ensures data flows even without WS positions) ---

  private startPositionPolling() {
    this.positionPollTimer = setInterval(
      () => this.pollPositionsForOpenTrades(),
      2000,
    );
    this.logger.log('Position polling started (2s interval)');
  }

  private stopPositionPolling() {
    if (this.positionPollTimer) {
      clearInterval(this.positionPollTimer);
      this.positionPollTimer = null;
    }
  }

  /**
   * Poll MT5 bridge for positions matching our open trades,
   * stream real profit to users, and reconcile any drift between the
   * MT5 ticket set and the DB Trade set (orphan positions in MT5,
   * ghost-open trades in the DB).
   */
  private async pollPositionsForOpenTrades() {
    if (!this.connected) return;

    try {
      const openTrades = await this.prisma.trade.findMany({
        where: { status: 'OPEN', mtOrderId: { not: null } },
        select: { id: true, userId: true, mtOrderId: true },
      });

      const mtPositions = await this.callBridge<any[]>('GET', '/positions');
      const posMap = new Map<string, any>();
      for (const p of mtPositions) {
        posMap.set(p.ticket, p);
      }

      for (const trade of openTrades) {
        if (!trade.mtOrderId || trade.mtOrderId.startsWith('mock-')) continue;

        const mtPos = posMap.get(trade.mtOrderId);
        if (mtPos) {
          const pnlData = {
            tradeId: trade.id,
            currentPrice: mtPos.current_price,
            unrealizedPnl: mtPos.profit,
            mtProfit: mtPos.profit,
            swap: mtPos.swap ?? 0,
            timestamp: Date.now(),
          };

          // Emit to trade-specific room (Flutter subscribes here)
          this.wsGateway.emitTradePnl(trade.id, pnlData);

          // Also emit to user room so the app receives it even without trade subscription
          this.wsGateway.emitToUser(trade.userId, 'trade:pnl', pnlData);

          // Stream to admin room
          this.wsGateway.emitAdminTradePnl(pnlData);
        }
      }

      // Also send all MT5 positions to admins for the MT5 Positions tab
      this.wsGateway.emitAdminMtPositions(mtPositions);

      // Reconciliation — surface drift between MT5 and the DB.
      await this.reconcileMtPositions(openTrades, mtPositions);
    } catch {
      // Bridge not reachable, skip this poll
    }
  }

  /**
   * Detect drift between MT5 open positions and DB Trade records:
   *  - Orphans: live in MT5 but no Trade row → adopt into the DB under a
   *    `__system__` user once they've been visible long enough that we
   *    know they're not just the brief gap between an MT5 order_send and
   *    the matching DB insert. Orphans on unknown symbols (no Symbol row
   *    with a matching mtSymbol) stay in the alert list.
   *  - Ghosts: Trade row says OPEN but the ticket is gone from MT5 →
   *    flip the row to CLOSED so admin lists stay honest.
   */
  private async reconcileMtPositions(
    openTrades: Array<{ id: string; userId: string; mtOrderId: string | null }>,
    mtPositions: any[],
  ) {
    const dbTicketSet = new Set(
      openTrades
        .map((t) => t.mtOrderId)
        .filter((id): id is string => !!id && !id.startsWith('mock-')),
    );

    // Orphans: in MT5 but not in DB.
    const orphans = mtPositions.filter(
      (p) => p && p.ticket && !dbTicketSet.has(String(p.ticket)),
    );

    const now = Date.now();
    const currentOrphanTickets = new Set<string>();
    const unadopted: any[] = [];

    for (const orphan of orphans) {
      const ticket = String(orphan.ticket);
      currentOrphanTickets.add(ticket);
      const firstSeen = this.firstSeenOrphan.get(ticket) ?? now;
      if (!this.firstSeenOrphan.has(ticket)) {
        this.firstSeenOrphan.set(ticket, now);
      }

      // Hold off adoption until the orphan has been visible long enough
      // that it's not just the race between MT5 order_send and the
      // /trades/open DB insert.
      if (now - firstSeen < MetatraderService.ORPHAN_ADOPT_DELAY_MS) {
        unadopted.push(orphan);
        continue;
      }

      const adopted = await this.adoptOrphanPosition(orphan);
      if (!adopted) {
        unadopted.push(orphan);
      } else {
        this.firstSeenOrphan.delete(ticket);
      }
    }

    // Drop first-seen entries for tickets that are no longer orphans
    // (either closed in MT5 or now matched in the DB).
    for (const ticket of Array.from(this.firstSeenOrphan.keys())) {
      if (!currentOrphanTickets.has(ticket)) {
        this.firstSeenOrphan.delete(ticket);
      }
    }

    if (unadopted.length > 0) {
      this.logger.warn(
        `MT5 reconciliation: ${unadopted.length} unadopted orphan position(s) — ` +
          unadopted.map((o) => `${o.ticket}/${o.symbol}`).join(', '),
      );
    }
    // Always emit (even when empty) so the admin UI clears stale banners.
    this.wsGateway.emitAdminOrphanPositions(unadopted);

    // Ghosts: in DB as OPEN but the ticket no longer exists in MT5.
    // Bridge already emits `status: CLOSED` for tickets it subscribed to,
    // but that only covers tickets the backend explicitly subscribed to.
    // The reconciliation here is the safety net.
    const mtTicketSet = new Set(
      mtPositions.map((p) => String(p?.ticket)).filter(Boolean),
    );
    const ghosts = openTrades.filter(
      (t) =>
        t.mtOrderId &&
        !t.mtOrderId.startsWith('mock-') &&
        !mtTicketSet.has(t.mtOrderId),
    );
    for (const ghost of ghosts) {
      try {
        await this.prisma.trade.update({
          where: { id: ghost.id },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
        this.logger.warn(
          `Reconciled ghost trade ${ghost.id} (mtOrderId=${ghost.mtOrderId}) — closed in DB to match MT5`,
        );
        this.wsGateway.emitTradePnl(ghost.id, {
          tradeId: ghost.id,
          status: 'CLOSED_ON_MT5',
          unrealizedPnl: 0,
          mtProfit: 0,
          timestamp: Date.now(),
        });
      } catch (err) {
        this.logger.error(
          `Failed to reconcile ghost trade ${ghost.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Adopt an MT5 orphan into the DB as a Trade row under the system user.
   * Returns true if a row was created; false if the position couldn't be
   * matched to a Symbol row (in which case the caller keeps the alert).
   */
  private async adoptOrphanPosition(orphan: {
    ticket: string;
    symbol?: string;
    type?: string;
    volume?: number;
    open_price?: number;
    current_price?: number;
  }): Promise<boolean> {
    const mtSymbol = orphan.symbol;
    if (!mtSymbol) return false;

    const symbol = await this.prisma.symbol.findFirst({
      where: { mtSymbol, isDeleted: false },
      orderBy: { isTradable: 'desc' },
      select: { id: true, lotSize: true },
    });
    if (!symbol) return false;

    const userId = await this.ensureSystemUserId();
    if (!userId) return false;

    // Defensive: another path may have inserted while we were waiting.
    const existing = await this.prisma.trade.findFirst({
      where: { mtOrderId: String(orphan.ticket) },
      select: { id: true },
    });
    if (existing) return true;

    const tradeType = (orphan.type ?? 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
    const lotSize = orphan.volume ?? Number(symbol.lotSize) ?? 0;
    const openPrice = orphan.open_price ?? 0;

    try {
      const trade = await this.prisma.trade.create({
        data: {
          userId,
          symbolId: symbol.id,
          type: tradeType,
          status: 'OPEN',
          lotSize,
          openPrice,
          customerPrice: 0,
          commission: 0,
          mtOrderId: String(orphan.ticket),
        },
        include: {
          user: { select: { phone: true, firstName: true, lastName: true } },
          symbol: { select: { displayName: true, name: true, mtSymbol: true } },
        },
      });
      this.logger.warn(
        `Adopted orphan MT5 position ${orphan.ticket} (${mtSymbol}) into Trade ${trade.id} under __system__ user`,
      );
      this.wsGateway.emitAdminTradeOpened(trade);
      this.subscribePositionTicket(String(orphan.ticket));
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to adopt orphan ${orphan.ticket}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Returns the id of the `__system__` user, creating it on first use.
   * Used to attribute trades that exist in MT5 with no matching user
   * (e.g. positions opened manually in the MT5 terminal). The system
   * user is permanently inactive so it can never log in.
   */
  private async ensureSystemUserId(): Promise<string | null> {
    if (this.systemUserId) return this.systemUserId;
    try {
      const user = await this.prisma.user.upsert({
        where: { phone: '__system__' },
        update: {},
        create: {
          phone: '__system__',
          // Random unrecoverable password — login is also blocked by isActive=false.
          password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
          firstName: 'MT5',
          lastName: 'System',
          role: 'USER',
          isActive: false,
        },
        select: { id: true },
      });
      this.systemUserId = user.id;
      return this.systemUserId;
    } catch (err) {
      this.logger.error(
        `Failed to ensure __system__ user: ${(err as Error).message}`,
      );
      return null;
    }
  }

  // --- HTTP calls to Python bridge ---

  private async callBridge<T>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    const url = `${this.bridgeUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Bridge error: ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // --- Public API ---

  async connect(login: string, password: string, server: string): Promise<any> {
    try {
      const result = await this.callBridge<any>('POST', '/connect', {
        login: parseInt(login),
        password,
        server,
      });
      this.connected = true;
      await this.connectPriceStream();
      this.startPositionPolling();

      await this.prisma.mtAccount.upsert({
        where: { accountId: 'mt5-direct' },
        update: {
          isConnected: true,
          login,
          brokerServer: server,
        },
        create: {
          accountId: 'mt5-direct',
          isConnected: true,
          platform: 'mt5',
          login,
          brokerServer: server,
        },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  async autoConnect(): Promise<any> {
    try {
      const result = await this.callBridge<any>('POST', '/auto-connect');
      this.connected = true;
      await this.connectPriceStream();
      this.startPositionPolling();

      await this.prisma.mtAccount.upsert({
        where: { accountId: 'mt5-direct' },
        update: {
          isConnected: true,
          login: String(result.login),
          brokerServer: result.server,
        },
        create: {
          accountId: 'mt5-direct',
          isConnected: true,
          platform: 'mt5',
          login: String(result.login),
          brokerServer: result.server,
        },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.disconnectPriceStream();
    this.stopPositionPolling();
    try {
      await this.callBridge('POST', '/disconnect');
    } catch {
      // ignore
    }
    this.connected = false;
    await this.prisma.mtAccount.updateMany({ data: { isConnected: false } });
  }

  async getConnectionStatus() {
    try {
      const status = await this.callBridge<any>('GET', '/status');
      this.connected = status.connected;

      const dbAccount = await this.prisma.mtAccount.findFirst();
      return {
        connected: status.connected,
        accountId: dbAccount?.accountId ?? null,
        platform: dbAccount?.platform ?? null,
        login: status.login
          ? String(status.login)
          : (dbAccount?.login ?? null),
        brokerServer: status.server ?? (dbAccount?.brokerServer ?? null),
        balance: status.balance ?? null,
        equity: status.equity ?? null,
      };
    } catch {
      return {
        connected: false,
        accountId: null,
        platform: null,
        login: null,
        brokerServer: null,
      };
    }
  }

  async loadSymbols(): Promise<MtSymbol[]> {
    try {
      const symbols = await this.callBridge<MtSymbol[]>('GET', '/symbols');
      if (symbols && symbols.length > 0) {
        return symbols;
      }
    } catch {
      // Bridge not reachable, fall back to mock
    }

    return [
      { symbol: 'XAUUSD', description: 'Gold vs US Dollar', digits: 2 },
      { symbol: 'XAGUSD', description: 'Silver vs US Dollar', digits: 3 },
      { symbol: 'EURUSD', description: 'Euro vs US Dollar', digits: 5 },
    ];
  }

  async getPrice(
    symbol: string,
  ): Promise<{ bid: number; ask: number }> {
    try {
      return await this.callBridge<{ bid: number; ask: number }>(
        'GET',
        `/price/${symbol}`,
      );
    } catch {
      return { bid: 0, ask: 0 };
    }
  }

  /**
   * Check if the bridge is reachable and update connected flag.
   */
  private async ensureConnected(): Promise<boolean> {
    if (this.connected) return true;

    // Try to reach the bridge dynamically
    try {
      const status = await this.callBridge<any>('GET', '/status');
      if (status.connected) {
        this.connected = true;
        this.logger.log('MT5 Bridge reconnected dynamically');
        // Start streaming if not already
        if (!this.priceWs || this.priceWs.readyState !== WebSocket.OPEN) {
          await this.connectPriceStream();
        }
        if (!this.positionPollTimer) {
          this.startPositionPolling();
        }
        return true;
      }
    } catch {
      // Bridge not reachable
    }
    return false;
  }

  async openPosition(
    symbol: string,
    lot: number,
    type: 'buy' | 'sell',
    userName?: string,
  ): Promise<MtTradeResult> {
    this.logger.log(`Opening ${type} position: ${symbol} lot=${lot} for ${userName || 'unknown'}`);

    const isConnected = await this.ensureConnected();
    if (!isConnected) {
      this.logger.warn('MT5 not connected, returning mock trade');
      const mockId = `mock-${Date.now()}`;
      return {
        orderId: mockId,
        positionId: mockId,
        openPrice: 0,
        closePrice: 0,
        profit: 0,
      };
    }

    const requestId = uuidv4();
    const comment = userName ? `${userName}` : 'AzinFX';
    const result = await this.callBridge<any>('POST', '/trade/open', {
      symbol,
      lot,
      type,
      request_id: requestId,
      comment,
    });

    const positionId = result.position_id || result.order_id;

    // Subscribe to this position's updates
    this.subscribePositionTicket(positionId);

    return {
      orderId: result.order_id,
      positionId,
      openPrice: result.open_price ?? result.price ?? 0,
      closePrice: 0,
      profit: 0,
    };
  }

  async closePosition(mtOrderId: string): Promise<MtTradeResult> {
    this.logger.log(`Closing position: ${mtOrderId}`);

    const isConnected = await this.ensureConnected();
    if (!isConnected) {
      return {
        orderId: mtOrderId,
        positionId: mtOrderId,
        openPrice: 0,
        closePrice: 2000 + Math.random() * 100,
        profit: Math.random() * 200 - 100,
      };
    }

    const requestId = uuidv4();
    const result = await this.callBridge<any>('POST', '/trade/close', {
      position_id: parseInt(mtOrderId),
      request_id: requestId,
    });

    // Unsubscribe from position updates
    this.unsubscribePositionTicket(mtOrderId);

    return {
      orderId: result.order_id ?? mtOrderId,
      positionId: mtOrderId,
      openPrice: 0,
      closePrice: result.close_price,
      profit: result.profit ?? 0,
    };
  }

  async getPositions() {
    try {
      return await this.callBridge<any[]>('GET', '/positions');
    } catch {
      return [];
    }
  }
}
