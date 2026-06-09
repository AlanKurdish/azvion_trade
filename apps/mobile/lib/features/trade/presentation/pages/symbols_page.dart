import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../bloc/symbols_bloc.dart';
import 'trade_detail_page.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/network/websocket_client.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';

class SymbolsPage extends StatefulWidget {
  const SymbolsPage({super.key});

  @override
  State<SymbolsPage> createState() => _SymbolsPageState();
}

class _SymbolsPageState extends State<SymbolsPage> {
  final WebSocketClient _wsClient = sl<WebSocketClient>();
  final Map<String, Map<String, dynamic>> _livePrices = {};
  StreamSubscription? _priceSub;
  List<String> _subscribedSymbols = [];
  // Selected category id — empty string = All; 'uncat' = symbols with no category
  String _selectedCategoryId = '';
  // Cached user role so the buy/sell prices show the role-correct commission.
  // Defaults to USER for guests; loaded once from secure storage on init.
  String _userRole = 'USER';

  @override
  void initState() {
    super.initState();
    _loadUserRole();
    _priceSub = _wsClient.on('price:update').listen((data) {
      if (data is Map<String, dynamic> && data['symbol'] != null) {
        // Key by symbolId if available (formula prices), otherwise by mtSymbol
        final key = data['symbolId']?.toString() ?? data['symbol'].toString();
        setState(() {
          _livePrices[key] = data;
        });
      }
    });
  }

  Future<void> _loadUserRole() async {
    const storage = FlutterSecureStorage();
    final role = await storage.read(key: 'user_role');
    if (role != null && mounted) {
      setState(() => _userRole = role);
    }
  }

  void _subscribeToSymbols(List<dynamic> symbols) {
    final mtSymbols = symbols
        .map<String>((s) => s['mtSymbol']?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toSet()
        .toList();

    if (mtSymbols.isNotEmpty && mtSymbols.join(',') != _subscribedSymbols.join(',')) {
      if (_subscribedSymbols.isNotEmpty) {
        _wsClient.unsubscribePrices(_subscribedSymbols);
      }
      _wsClient.subscribePrices(mtSymbols);
      _subscribedSymbols = mtSymbols;
    }
  }

  @override
  void dispose() {
    _priceSub?.cancel();
    if (_subscribedSymbols.isNotEmpty) {
      _wsClient.unsubscribePrices(_subscribedSymbols);
    }
    super.dispose();
  }

  /// Pick the right language field for the category name
  String _categoryLabel(Map<String, dynamic> cat, String langCode) {
    switch (langCode) {
      case 'ar':
        return cat['nameAr']?.toString() ?? cat['nameEn']?.toString() ?? '';
      case 'ckb':
        return cat['nameCkb']?.toString() ?? cat['nameEn']?.toString() ?? '';
      default:
        return cat['nameEn']?.toString() ?? '';
    }
  }

  List<dynamic> _filterSymbols(List<dynamic> symbols) {
    if (_selectedCategoryId.isEmpty) return symbols;
    if (_selectedCategoryId == 'uncat') {
      return symbols.where((s) => s['categoryId'] == null).toList();
    }
    return symbols.where((s) => s['categoryId'] == _selectedCategoryId).toList();
  }

  bool get _isLoggedIn {
    try {
      final authState = context.read<AuthBloc>().state;
      return authState is AuthAuthenticated;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final langCode = Localizations.localeOf(context).languageCode;

    return BlocProvider(
      create: (_) => sl<SymbolsBloc>()..add(LoadSymbols()),
      child: Scaffold(
        appBar: AppBar(title: Text(t.tr('trade'))),
        body: BlocConsumer<SymbolsBloc, SymbolsState>(
          listener: (context, state) {
            if (state is SymbolsLoaded) {
              _subscribeToSymbols(state.symbols);
            }
          },
          builder: (context, state) {
            if (state is SymbolsLoading) {
              return const Center(child: CircularProgressIndicator(color: Color(0xFFD4AF37)));
            }
            if (state is SymbolsError) {
              return Center(child: Text(state.message));
            }
            if (state is SymbolsLoaded) {
              if (state.symbols.isEmpty) {
                return Center(child: Text(t.tr('noSymbols'), style: const TextStyle(color: Colors.grey)));
              }

              final categories = state.categories;
              final hasUncategorized = state.symbols.any((s) => s['categoryId'] == null);
              final filtered = _filterSymbols(state.symbols);

              // Only show symbols whose market is open (tradeMode == 4).
              // Symbols with no live price yet are kept visible while we wait
              // for the first WebSocket tick.
              final visible = filtered.where((sym) {
                final lp = _livePrices[sym['id']?.toString() ?? '']
                    ?? _livePrices[sym['mtSymbol']?.toString() ?? ''];
                if (lp == null) return true; // waiting for first tick — keep visible
                final tm = (lp['tradeMode'] as num?)?.toInt() ?? 4;
                return tm == 4; // 4 = market open
              }).toList();

              return Column(
                children: [
                  // Horizontal tab bar — from backend categories
                  if (categories.isNotEmpty || hasUncategorized)
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        children: [
                          _TabChip(
                            label: t.tr('all'),
                            selected: _selectedCategoryId.isEmpty,
                            onTap: () => setState(() => _selectedCategoryId = ''),
                          ),
                          ...categories.map((cat) => _TabChip(
                                label: _categoryLabel(cat as Map<String, dynamic>, langCode),
                                selected: _selectedCategoryId == cat['id'],
                                onTap: () => setState(() => _selectedCategoryId = cat['id']?.toString() ?? ''),
                              )),
                          if (hasUncategorized)
                            _TabChip(
                              label: t.tr('other'),
                              selected: _selectedCategoryId == 'uncat',
                              onTap: () => setState(() => _selectedCategoryId = 'uncat'),
                            ),
                        ],
                      ),
                    ),

                  // Symbol list — market-open only
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: () async {
                        context.read<SymbolsBloc>().add(LoadSymbols());
                      },
                      child: visible.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.access_time, size: 48, color: Colors.grey[600]),
                                  const SizedBox(height: 12),
                                  Text(
                                    t.tr('marketClosed'),
                                    style: TextStyle(color: Colors.grey[500], fontSize: 15),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: visible.length,
                              itemBuilder: (context, index) {
                                final sym = visible[index];
                                final livePrice = _livePrices[sym['id']?.toString() ?? '']
                                    ?? _livePrices[sym['mtSymbol']?.toString() ?? ''];
                                return _SymbolCard(
                                  symbol: sym,
                                  livePrice: livePrice,
                                  isLoggedIn: _isLoggedIn,
                                  userRole: _userRole,
                                );
                              },
                            ),
                    ),
                  ),
                ],
              );
            }
            return const SizedBox();
          },
        ),
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _TabChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: selected
                ? const Color(0xFFD4AF37)
                : Theme.of(context).cardTheme.color,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? const Color(0xFFD4AF37) : Theme.of(context).dividerColor,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.black : Colors.grey,
            ),
          ),
        ),
      ),
    );
  }
}

class _SymbolCard extends StatelessWidget {
  final Map<String, dynamic> symbol;
  final Map<String, dynamic>? livePrice;
  final bool isLoggedIn;
  final String userRole;

  const _SymbolCard({
    required this.symbol,
    this.livePrice,
    required this.isLoggedIn,
    this.userRole = 'USER',
  });

  /// Pick the role-correct commission, falling back to legacy `commission`.
  double get _commission {
    final fromRole = userRole == 'SHOP'
        ? double.tryParse((symbol['commissionShop'] ?? 0).toString()) ?? 0
        : double.tryParse((symbol['commissionUser'] ?? 0).toString()) ?? 0;
    if (fromRole > 0) return fromRole;
    return double.tryParse((symbol['commission'] ?? 0).toString()) ?? 0;
  }

  /// Smart decimal formatting based on price magnitude
  String formatPrice(double price) {
    if (price == 0) return '0';
    if (price >= 1000) return price.toStringAsFixed(2);    // Gold, indices
    if (price >= 10) return price.toStringAsFixed(3);       // Silver, oil
    if (price >= 1) return price.toStringAsFixed(4);        // EUR/USD etc.
    return price.toStringAsFixed(5);                         // Micro prices
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final formulaPrice = livePrice != null ? (livePrice!['formulaPrice'] as num?)?.toDouble() : null;
    final tradeMode = livePrice != null ? (livePrice!['tradeMode'] as num?)?.toInt() ?? 4 : null;
    final isSymbolOpen = tradeMode == null || tradeMode == 4;
    final isReadOnly = symbol['isReadOnly'] == true;
    final hasPrice = formulaPrice != null;

    final name = symbol['displayName']?.toString() ?? symbol['name']?.toString() ?? '';
    final amountLabel = symbol['amountLabel']?.toString() ?? '';
    final amount = symbol['amount']?.toString() ?? '';
    final subtitle = amountLabel.isNotEmpty ? '$amount ($amountLabel)' : amount;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: (isLoggedIn && !isReadOnly)
            ? () async {
                final result = await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => TradeDetailPage(symbol: symbol)),
                );
                if (result == true && context.mounted) {
                  context.read<SymbolsBloc>().add(LoadSymbols());
                }
              }
            : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Row 1: icon + name (fully visible) + status badge ─────
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD4AF37).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isReadOnly ? Icons.lock_outline : Icons.monetization_on,
                      color: const Color(0xFFD4AF37),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 11),
                  // Name — allowed to wrap to 2 lines so long Arabic/Kurdish
                  // names stay fully readable.
                  Expanded(
                    child: Text(
                      name,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 6),
                  if (isReadOnly)
                    _Badge(label: t.tr('readOnly'), color: Colors.amber)
                  else if (tradeMode != null)
                    _Badge(
                      label: isSymbolOpen ? t.tr('open') : t.tr('closed'),
                      color: isSymbolOpen ? Colors.green : Colors.red,
                    ),
                ],
              ),

              // ── Subtitle (amount label) ──────────────────────────────
              if (subtitle.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 49, top: 4),
                  child: Text(
                    subtitle,
                    style: TextStyle(color: Colors.grey[500], fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),

              const SizedBox(height: 10),

              // ── Row 2: SELL and BUY side by side, full card width ────
              if (hasPrice)
                Row(
                  children: [
                    Expanded(
                      child: _PriceRow(
                        label: t.tr('sell'),
                        value: formatPrice(formulaPrice!),
                        color: Colors.red,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _PriceRow(
                        label: t.tr('buy'),
                        value: formatPrice(formulaPrice! + _commission),
                        color: Colors.green,
                      ),
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    Container(
                      width: 5, height: 5,
                      decoration: const BoxDecoration(
                        color: Colors.orange, shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      t.tr('waitingPrice'),
                      style: TextStyle(color: Colors.grey[500], fontSize: 11),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tiny status/label pill used inside the symbol card.
class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  const _Badge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color),
      ),
    );
  }
}

/// One side of the dual-price display: SELL or BUY pill + price value.
/// Used inside Expanded() so each side gets half the card width.
class _PriceRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _PriceRow({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.18)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: color.withOpacity(0.18),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Text(
              label.toUpperCase(),
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: color,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: color,
                fontFamily: 'monospace',
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
