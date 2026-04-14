import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/positions_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/network/websocket_client.dart';
import '../../../../l10n/app_localizations.dart';

/// Smart decimal formatting based on price magnitude
String _formatPrice(double price) {
  if (price == 0) return '0';
  final abs = price.abs();
  if (abs >= 1000) return price.toStringAsFixed(2);
  if (abs >= 10) return price.toStringAsFixed(3);
  if (abs >= 1) return price.toStringAsFixed(4);
  return price.toStringAsFixed(5);
}

class PositionsPage extends StatelessWidget {
  const PositionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => PositionsBloc(sl(), sl<WebSocketClient>())..add(LoadOpenPositions()),
      child: const _PositionsView(),
    );
  }
}

class _PositionsView extends StatefulWidget {
  const _PositionsView();

  @override
  State<_PositionsView> createState() => _PositionsViewState();
}

class _PositionsViewState extends State<_PositionsView> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(t.tr('positions')),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFD4AF37),
          tabs: [
            Tab(text: t.tr('openTrades')),
            Tab(text: t.tr('history')),
          ],
          onTap: (index) {
            final bloc = context.read<PositionsBloc>();
            if (index == 0) {
              bloc.add(LoadOpenPositions());
            } else {
              bloc.add(LoadHistory());
            }
          },
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _OpenPositionsTab(),
          _HistoryTab(),
        ],
      ),
    );
  }
}

class _OpenPositionsTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return BlocBuilder<PositionsBloc, PositionsState>(
      builder: (context, state) {
        if (state is PositionsLoading) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state is PositionsError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 48),
                const SizedBox(height: 12),
                Text(state.message, style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => context.read<PositionsBloc>().add(LoadOpenPositions()),
                  child: Text(t.tr('retry')),
                ),
              ],
            ),
          );
        }
        if (state is OpenPositionsLoaded) {
          if (state.positions.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.inbox_outlined, size: 64, color: Colors.grey),
                  const SizedBox(height: 12),
                  Text(t.tr('noOpenPositions'), style: const TextStyle(color: Colors.grey, fontSize: 16)),
                ],
              ),
            );
          }

          // Calculate total P&L
          double totalPnl = 0;
          for (final trade in state.positions) {
            final tradeId = trade['id']?.toString() ?? '';
            final pnl = state.livePnl[tradeId];
            if (pnl != null) {
              totalPnl += (pnl['mtProfit'] as num?)?.toDouble() ?? 0;
            }
          }

          return Column(
            children: [
              // Summary bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: Theme.of(context).colorScheme.surface,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${state.positions.length} ${t.tr('positionsCount')}',
                      style: const TextStyle(color: Colors.grey, fontSize: 13),
                    ),
                    Row(
                      children: [
                        Text('${t.tr('pnl')}: ', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                        Text(
                          '${totalPnl >= 0 ? '+' : ''}\$${totalPnl.toStringAsFixed(2)}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: totalPnl >= 0 ? Colors.green : Colors.red,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Trade list
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async {
                    context.read<PositionsBloc>().add(LoadOpenPositions());
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: state.positions.length,
                    itemBuilder: (context, index) {
                      final trade = state.positions[index];
                      return _TradeCard(trade: trade, state: state);
                    },
                  ),
                ),
              ),
            ],
          );
        }
        return const SizedBox();
      },
    );
  }
}

class _TradeCard extends StatelessWidget {
  final dynamic trade;
  final OpenPositionsLoaded state;

  const _TradeCard({required this.trade, required this.state});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final tradeId = trade['id']?.toString() ?? '';
    final symbolName = trade['symbol']?['displayName'] ?? 'Unknown';
    final mtSymbol = trade['symbol']?['mtSymbol']?.toString() ?? '';
    final symbolId = trade['symbolId']?.toString() ?? '';
    final type = trade['type']?.toString() ?? 'BUY';
    // Show formula price (customerPrice) as the open price, not MT5 market price
    final customerPrice = double.tryParse(trade['customerPrice']?.toString() ?? '0') ?? 0;
    final lotSize = trade['lotSize']?.toString() ?? '-';
    final commission = double.tryParse(trade['commission']?.toString() ?? '0') ?? 0;
    final isClosing = state.closingTradeId == tradeId;

    // Live P&L from WebSocket
    final pnl = state.livePnl[tradeId];
    final unrealizedPnl = (pnl?['mtProfit'] as num?)?.toDouble();

    // Live formula price: lookup by symbolId first, then mtSymbol
    final livePrice = state.livePrices[symbolId] ?? state.livePrices[mtSymbol];
    final liveFormulaPrice = (livePrice?['formulaPrice'] as num?)?.toDouble();
    final displayCurrentPrice = liveFormulaPrice;

    final isBuy = type == 'BUY';
    final pnlColor = (unrealizedPnl ?? 0) >= 0 ? Colors.green : Colors.red;

    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            // Row 1: Symbol + Type + Lot
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isBuy ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    type,
                    style: TextStyle(
                      color: isBuy ? Colors.green : Colors.red,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(symbolName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const Spacer(),
                const SizedBox(),
              ],
            ),
            const SizedBox(height: 10),
            // Row 2: Open Price | Current Price | P&L
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.tr('openLabel'), style: const TextStyle(color: Colors.grey, fontSize: 10)),
                      Text(
                        '\$${_formatPrice(customerPrice)}',
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(t.tr('current'), style: const TextStyle(color: Colors.grey, fontSize: 10)),
                      Text(
                        displayCurrentPrice != null
                            ? '\$${_formatPrice(displayCurrentPrice)}'
                            : '...',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          color: const Color(0xFFD4AF37),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(t.tr('pnl'), style: const TextStyle(color: Colors.grey, fontSize: 10)),
                      Text(
                        unrealizedPnl != null
                            ? '${unrealizedPnl >= 0 ? '+' : ''}\$${unrealizedPnl.toStringAsFixed(2)}'
                            : '-',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          fontFamily: 'monospace',
                          color: pnlColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Row 3: Close button
            Row(
              children: [
                const Spacer(),
                SizedBox(
                  height: 30,
                  child: ElevatedButton(
                    onPressed: isClosing
                        ? null
                        : () => _showCloseConfirmation(context, tradeId, symbolName),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.withOpacity(0.15),
                      foregroundColor: Colors.red,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    child: isClosing
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red))
                        : Text(t.tr('close'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showCloseConfirmation(BuildContext context, String tradeId, String symbolName) {
    final t = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.tr('closePosition')),
        content: Text('${t.tr('close')} $symbolName?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(t.tr('cancel')),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<PositionsBloc>().add(ClosePositionRequested(tradeId));
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text(t.tr('close'), style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

class _HistoryTab extends StatefulWidget {
  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> {
  DateTime? _fromDate;
  DateTime? _toDate;

  void _loadWithFilters() {
    context.read<PositionsBloc>().add(LoadHistory(fromDate: _fromDate, toDate: _toDate));
  }

  Future<void> _pickDate(bool isFrom) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? (_fromDate ?? now) : (_toDate ?? now),
      firstDate: DateTime(2024),
      lastDate: now,
      builder: (context, child) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: isDark
                ? const ColorScheme.dark(
                    primary: Color(0xFFD4AF37),
                    onPrimary: Colors.black,
                    surface: Color(0xFF1e293b),
                  )
                : const ColorScheme.light(
                    primary: Color(0xFFD4AF37),
                    onPrimary: Colors.black,
                    surface: Colors.white,
                  ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _fromDate = picked;
        } else {
          _toDate = picked;
        }
      });
      _loadWithFilters();
    }
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Column(
      children: [
        // Date filter bar
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => _pickDate(true),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).cardTheme.color,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Theme.of(context).dividerColor),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_today, size: 14, color: Color(0xFFD4AF37)),
                        const SizedBox(width: 6),
                        Text(
                          _fromDate != null ? _formatDate(_fromDate!) : t.tr('from'),
                          style: TextStyle(color: _fromDate != null ? (Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black87) : Colors.grey, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () => _pickDate(false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).cardTheme.color,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Theme.of(context).dividerColor),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_today, size: 14, color: Color(0xFFD4AF37)),
                        const SizedBox(width: 6),
                        Text(
                          _toDate != null ? _formatDate(_toDate!) : t.tr('to'),
                          style: TextStyle(color: _toDate != null ? (Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black87) : Colors.grey, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (_fromDate != null || _toDate != null) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () {
                    setState(() { _fromDate = null; _toDate = null; });
                    _loadWithFilters();
                  },
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.close, size: 16, color: Colors.red),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 4),
        // Trade list
        Expanded(
          child: BlocBuilder<PositionsBloc, PositionsState>(
            builder: (context, state) {
              if (state is PositionsLoading) {
                return const Center(child: CircularProgressIndicator());
              }
              if (state is PositionsError) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 48),
                      const SizedBox(height: 12),
                      Text(state.message, style: const TextStyle(color: Colors.grey)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _loadWithFilters,
                        child: Text(t.tr('retry')),
                      ),
                    ],
                  ),
                );
              }
              if (state is HistoryLoaded) {
                final stats = state.stats;
                final deposit = (stats['totalDeposit'] as num?)?.toDouble() ?? 0;
                final withdraw = (stats['totalWithdrawal'] as num?)?.toDouble() ?? 0;
                final totalPnl = (stats['totalPnl'] as num?)?.toDouble() ?? 0;
                final totalComm = (stats['totalCommission'] as num?)?.toDouble() ?? 0;
                final balance = (stats['balance'] as num?)?.toDouble() ?? 0;
                final closedCount = (stats['closedTradesCount'] as num?)?.toInt() ?? 0;

                return ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: state.trades.length + 1, // +1 for stats header
                  itemBuilder: (context, index) {
                    // First item = stats card
                    if (index == 0) {
                      return Column(
                        children: [
                          // Balance card
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: Theme.of(context).brightness == Brightness.dark
                                    ? [const Color(0xFF1e293b), const Color(0xFF0f172a)]
                                    : [Colors.white, const Color(0xFFF8F9FA)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.3)),
                            ),
                            child: Column(
                              children: [
                                Text(t.tr('balance'), style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                const SizedBox(height: 4),
                                Text(
                                  '\$${balance.toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFFD4AF37), fontFamily: 'monospace'),
                                ),
                                const SizedBox(height: 4),
                                Text('$closedCount ${t.tr('closedTrades')}', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Stats grid
                          Row(
                            children: [
                              _StatCard(
                                icon: Icons.arrow_downward,
                                iconColor: Colors.green,
                                label: t.tr('deposit'),
                                value: '\$${deposit.toStringAsFixed(2)}',
                              ),
                              const SizedBox(width: 8),
                              _StatCard(
                                icon: Icons.arrow_upward,
                                iconColor: Colors.red,
                                label: t.tr('withdraw'),
                                value: '\$${withdraw.toStringAsFixed(2)}',
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              _StatCard(
                                icon: Icons.trending_up,
                                iconColor: totalPnl >= 0 ? Colors.green : Colors.red,
                                label: t.tr('totalPnl'),
                                value: '${totalPnl >= 0 ? '+' : ''}\$${totalPnl.toStringAsFixed(2)}',
                                valueColor: totalPnl >= 0 ? Colors.green : Colors.red,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (state.trades.isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 32),
                              child: Column(
                                children: [
                                  const Icon(Icons.history, size: 48, color: Colors.grey),
                                  const SizedBox(height: 8),
                                  Text(t.tr('noTradeHistory'), style: const TextStyle(color: Colors.grey, fontSize: 14)),
                                ],
                              ),
                            ),
                        ],
                      );
                    }

                    // Trade items (index - 1 because index 0 is stats)
                    final tradeIndex = index - 1;
                    final trade = state.trades[tradeIndex];
                    final pnl = double.tryParse(trade['profitLoss']?.toString() ?? '0') ?? 0;
                    final customerPrice = double.tryParse(trade['customerPrice']?.toString() ?? '0') ?? 0;
                    final closePrice = double.tryParse(trade['customerClosePrice']?.toString() ?? '') ??
                        double.tryParse(trade['closePrice']?.toString() ?? '0') ?? 0;
                    final symbolName = trade['symbol']?['displayName'] ?? 'Unknown';
                    final type = trade['type']?.toString() ?? 'BUY';
                    final isBuy = type == 'BUY';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 6),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isBuy ? Colors.green.withValues(alpha: 0.15) : Colors.red.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(type, style: TextStyle(color: isBuy ? Colors.green : Colors.red, fontWeight: FontWeight.bold, fontSize: 11)),
                                ),
                                const SizedBox(width: 8),
                                Text(symbolName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                const Spacer(),
                                Text(
                                  '${pnl >= 0 ? '+' : ''}\$${pnl.toStringAsFixed(2)}',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: pnl >= 0 ? Colors.green : Colors.red),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Open: \$${_formatPrice(customerPrice)}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                Text('Close: \$${_formatPrice(closePrice)}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                Text(
                                  trade['closedAt'] != null ? DateTime.parse(trade['closedAt']).toLocal().toString().substring(0, 16) : '',
                                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              }
              return Center(child: Text(t.tr('tapHistoryToLoad')));
            },
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final Color? valueColor;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1e293b) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(color: Colors.grey, fontSize: 10)),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      fontFamily: 'monospace',
                      color: valueColor ?? Colors.white,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
