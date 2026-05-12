import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
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

  @override
  void initState() {
    super.initState();
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

              // Show every symbol regardless of market state. The bridge
              // keeps streaming the last known price when the market is
              // closed, and the open/closed badge on the card makes the
              // status clear to the user.
              final visible = filtered;

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

                  // Symbol list — open + closed symbols, badge tells status
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: () async {
                        context.read<SymbolsBloc>().add(LoadSymbols());
                      },
                      child: visible.isEmpty
                          ? Center(
                              child: Text(
                                t.tr('noSymbols'),
                                style: const TextStyle(color: Colors.grey),
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

  const _SymbolCard({required this.symbol, this.livePrice, required this.isLoggedIn});

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
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // ── Icon ──────────────────────────────────────────────────
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFD4AF37).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  isReadOnly ? Icons.lock_outline : Icons.monetization_on,
                  color: const Color(0xFFD4AF37),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),

              // ── Name + subtitle (takes all remaining space) ───────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Name + status badge on same line
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isReadOnly) ...[
                          const SizedBox(width: 5),
                          _Badge(label: t.tr('readOnly'), color: Colors.amber),
                        ] else if (tradeMode != null) ...[
                          const SizedBox(width: 5),
                          _Badge(
                            label: isSymbolOpen ? t.tr('open') : t.tr('closed'),
                            color: isSymbolOpen ? Colors.green : Colors.red,
                          ),
                        ],
                      ],
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: TextStyle(color: Colors.grey[500], fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    // Waiting indicator inline under the subtitle
                    if (livePrice == null) ...[
                      const SizedBox(height: 4),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 5, height: 5,
                            decoration: const BoxDecoration(
                              color: Colors.orange, shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            t.tr('waitingPrice'),
                            style: TextStyle(color: Colors.grey[500], fontSize: 10),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // ── Price (fixed width so it never overlaps the name) ─────
              SizedBox(
                width: 96,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (hasPrice) ...[
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Container(
                            width: 6, height: 6,
                            decoration: const BoxDecoration(
                              color: Colors.green, shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              formatPrice(formulaPrice!),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFD4AF37),
                                fontFamily: 'monospace',
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.end,
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      Text(
                        '—',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                        ),
                        textAlign: TextAlign.end,
                      ),
                    ],
                  ],
                ),
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
