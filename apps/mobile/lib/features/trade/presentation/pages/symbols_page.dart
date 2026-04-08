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
  String _selectedTab = ''; // '' = All

  @override
  void initState() {
    super.initState();
    _priceSub = _wsClient.on('price:update').listen((data) {
      if (data is Map<String, dynamic> && data['symbol'] != null) {
        setState(() {
          _livePrices[data['symbol']] = data;
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

  /// Strip broker suffix from MT symbol (e.g., XAUUSD.ecn → XAUUSD, AAPL.raw → AAPL)
  String _baseSymbol(String mtSymbol) {
    final dot = mtSymbol.indexOf('.');
    return dot > 0 ? mtSymbol.substring(0, dot) : mtSymbol;
  }

  /// Get unique MT symbol base names for tabs
  List<String> _getTabNames(List<dynamic> symbols) {
    final names = <String>{};
    for (final s in symbols) {
      final base = _baseSymbol(s['mtSymbol']?.toString() ?? '');
      if (base.isNotEmpty) names.add(base);
    }
    return names.toList()..sort();
  }

  List<dynamic> _filterSymbols(List<dynamic> symbols) {
    if (_selectedTab.isEmpty) return symbols;
    return symbols.where((s) {
      return _baseSymbol(s['mtSymbol']?.toString() ?? '') == _selectedTab;
    }).toList();
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

              final tabNames = _getTabNames(state.symbols);
              final filtered = _filterSymbols(state.symbols);

              return Column(
                children: [
                  // Horizontal tab bar
                  SizedBox(
                    height: 44,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      children: [
                        _TabChip(
                          label: t.tr('all'),
                          selected: _selectedTab.isEmpty,
                          onTap: () => setState(() => _selectedTab = ''),
                        ),
                        ...tabNames.map((name) => _TabChip(
                          label: name,
                          selected: _selectedTab == name,
                          onTap: () => setState(() => _selectedTab = name),
                        )),
                      ],
                    ),
                  ),

                  // Symbol list
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: () async {
                        context.read<SymbolsBloc>().add(LoadSymbols());
                      },
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          return _SymbolCard(
                            symbol: filtered[index],
                            livePrice: _livePrices[filtered[index]['mtSymbol']?.toString() ?? ''],
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
            color: selected ? const Color(0xFFD4AF37) : const Color(0xFF1e293b),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? const Color(0xFFD4AF37) : const Color(0xFF334155),
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
    final mtSymbol = symbol['mtSymbol']?.toString() ?? '';
    final bid = livePrice != null ? (livePrice!['bid'] as num?)?.toDouble() : null;
    final ask = livePrice != null ? (livePrice!['ask'] as num?)?.toDouble() : null;
    final tradeMode = livePrice != null ? (livePrice!['tradeMode'] as num?)?.toInt() ?? 4 : null;
    final isSymbolOpen = tradeMode == null || tradeMode == 4;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: isLoggedIn
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
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 42, height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD4AF37).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.monetization_on, color: Color(0xFFD4AF37), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                symbol['displayName'] ?? symbol['name'],
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (tradeMode != null) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: isSymbolOpen ? Colors.green.withOpacity(0.12) : Colors.red.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  isSymbolOpen ? t.tr('open') : t.tr('closed'),
                                  style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: isSymbolOpen ? Colors.green : Colors.red),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          symbol['amountLabel']?.toString() ?? '${symbol['amount'] ?? ''}',
                          style: TextStyle(color: Colors.grey[500], fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '\$${symbol['price']}',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFFD4AF37)),
                      ),
                    ],
                  ),
                ],
              ),
              // Live price bar
              if (bid != null && ask != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0f172a),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(children: [
                        Container(width: 5, height: 5, decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle)),
                        const SizedBox(width: 5),
                        Text(t.tr('live'), style: TextStyle(color: Colors.grey[600], fontSize: 10)),
                      ]),
                      Row(children: [
                        Text('${t.tr('bid')}: ', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                        Text(formatPrice(bid), style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600, fontSize: 12, fontFamily: 'monospace')),
                        const SizedBox(width: 12),
                        Text('${t.tr('ask')}: ', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                        Text(formatPrice(ask), style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w600, fontSize: 12, fontFamily: 'monospace')),
                      ]),
                    ],
                  ),
                ),
              ] else ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: const Color(0xFF0f172a), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    Container(width: 5, height: 5, decoration: const BoxDecoration(color: Colors.orange, shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    Text(t.tr('waitingPrice'), style: TextStyle(color: Colors.grey[600], fontSize: 10)),
                  ]),
                ),
              ],
              // Login prompt for non-logged-in users
              if (!isLoggedIn) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    t.tr('login'),
                    style: TextStyle(color: Colors.grey[600], fontSize: 11),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
