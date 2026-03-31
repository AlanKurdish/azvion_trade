import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/symbols_bloc.dart';
import 'trade_detail_page.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/network/websocket_client.dart';

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

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<SymbolsBloc>()..add(LoadSymbols()),
      child: Scaffold(
        appBar: AppBar(title: const Text('Trade')),
        body: BlocConsumer<SymbolsBloc, SymbolsState>(
          listener: (context, state) {
            if (state is SymbolsLoaded) {
              _subscribeToSymbols(state.symbols);
            }
          },
          builder: (context, state) {
            if (state is SymbolsLoading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state is SymbolsError) {
              return Center(child: Text(state.message));
            }
            if (state is SymbolsLoaded) {
              if (state.symbols.isEmpty) {
                return const Center(child: Text('No symbols available'));
              }
              return RefreshIndicator(
                onRefresh: () async {
                  context.read<SymbolsBloc>().add(LoadSymbols());
                },
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.symbols.length,
                  itemBuilder: (context, index) {
                    final symbol = state.symbols[index];
                    final mtSymbol = symbol['mtSymbol']?.toString() ?? '';
                    final livePrice = _livePrices[mtSymbol];
                    final bid = livePrice != null ? (livePrice['bid'] as num?)?.toDouble() : null;
                    final ask = livePrice != null ? (livePrice['ask'] as num?)?.toDouble() : null;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () async {
                          final result = await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TradeDetailPage(symbol: symbol),
                            ),
                          );
                          if (result == true) {
                            // Refresh symbols after trade
                            if (context.mounted) {
                              context.read<SymbolsBloc>().add(LoadSymbols());
                            }
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  const CircleAvatar(
                                    backgroundColor: Color(0xFFD4AF37),
                                    child: Icon(Icons.monetization_on, color: Colors.black),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          symbol['displayName'] ?? symbol['name'],
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                                        ),
                                        Text(
                                          mtSymbol,
                                          style: const TextStyle(color: Colors.grey, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        '\$${symbol['price']}',
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFD4AF37),
                                        ),
                                      ),
                                      Text(
                                        'Lot: ${symbol['lotSize']}',
                                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              // Live price bar
                              if (bid != null && ask != null) ...[
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.surface,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            width: 6,
                                            height: 6,
                                            decoration: const BoxDecoration(
                                              color: Colors.green,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          const Text('Live', style: TextStyle(color: Colors.grey, fontSize: 11)),
                                        ],
                                      ),
                                      Row(
                                        children: [
                                          Text(
                                            'Bid: ',
                                            style: TextStyle(color: Colors.grey[600], fontSize: 13),
                                          ),
                                          Text(
                                            bid.toStringAsFixed(bid > 100 ? 2 : 5),
                                            style: const TextStyle(
                                              color: Colors.redAccent,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13,
                                              fontFamily: 'monospace',
                                            ),
                                          ),
                                          const SizedBox(width: 16),
                                          Text(
                                            'Ask: ',
                                            style: TextStyle(color: Colors.grey[600], fontSize: 13),
                                          ),
                                          Text(
                                            ask.toStringAsFixed(ask > 100 ? 2 : 5),
                                            style: const TextStyle(
                                              color: Colors.green,
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13,
                                              fontFamily: 'monospace',
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ] else ...[
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).colorScheme.surface,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 6,
                                        height: 6,
                                        decoration: const BoxDecoration(
                                          color: Colors.orange,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      const Text(
                                        'Waiting for live price...',
                                        style: TextStyle(color: Colors.grey, fontSize: 11),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              );
            }
            return const SizedBox();
          },
        ),
      ),
    );
  }
}
