import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/trade_bloc.dart';
import '../../../../core/di/injection.dart';

class TradeDetailPage extends StatelessWidget {
  final Map<String, dynamic> symbol;
  const TradeDetailPage({super.key, required this.symbol});

  @override
  Widget build(BuildContext context) {
    final symbolId = symbol['id']?.toString() ?? '';
    final mtSymbol = symbol['mtSymbol']?.toString() ?? '';

    return BlocProvider(
      create: (_) {
        final bloc = sl<TradeBloc>();
        bloc.subscribeToPriceStream(mtSymbol);
        bloc.add(LoadOpenTrades(symbolId));
        return bloc;
      },
      child: _TradeDetailView(symbol: symbol),
    );
  }
}

class _TradeDetailView extends StatelessWidget {
  final Map<String, dynamic> symbol;
  const _TradeDetailView({required this.symbol});

  @override
  Widget build(BuildContext context) {
    final mtSymbol = symbol['mtSymbol']?.toString() ?? '';
    final price = double.tryParse(symbol['price'].toString()) ?? 0;
    final commission = double.tryParse(symbol['commission'].toString()) ?? 0;
    final totalCost = price + commission;

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          context.read<TradeBloc>().unsubscribeFromPriceStream(mtSymbol);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(symbol['displayName'] ?? symbol['name'] ?? ''),
        ),
        body: BlocConsumer<TradeBloc, TradeState>(
          listener: (context, state) {
            if (state is TradeReady) {
              if (state.errorMessage != null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(state.errorMessage!), backgroundColor: Colors.red),
                );
              }
              if (state.successMessage != null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(state.successMessage!), backgroundColor: Colors.green),
                );
              }
            }
          },
          builder: (context, state) {
            if (state is TradeLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            final tradeReady = state is TradeReady ? state : null;
            final openTrades = tradeReady?.openTrades ?? [];
            final liveBid = tradeReady?.liveBid;
            final liveAsk = tradeReady?.liveAsk;
            final isBuying = tradeReady?.isBuying ?? false;

            return SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Symbol info + live price card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          const Icon(Icons.monetization_on, size: 48, color: Color(0xFFD4AF37)),
                          const SizedBox(height: 12),
                          Text(
                            symbol['displayName'] ?? '',
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 4),
                          Text(mtSymbol, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                          const SizedBox(height: 16),

                          // Live price display
                          if (liveBid != null && liveAsk != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  Column(
                                    children: [
                                      const Text('BID', style: TextStyle(color: Colors.grey, fontSize: 11)),
                                      const SizedBox(height: 4),
                                      Text(
                                        liveBid.toStringAsFixed(liveBid > 100 ? 2 : 5),
                                        style: const TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.redAccent,
                                          fontFamily: 'monospace',
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(width: 1, height: 30, color: Colors.grey.withValues(alpha: 0.3)),
                                  Column(
                                    children: [
                                      const Text('ASK', style: TextStyle(color: Colors.grey, fontSize: 11)),
                                      const SizedBox(height: 4),
                                      Text(
                                        liveAsk.toStringAsFixed(liveAsk > 100 ? 2 : 5),
                                        style: const TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.green,
                                          fontFamily: 'monospace',
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Spread: ${((liveAsk - liveBid) * (liveBid > 100 ? 100 : 100000)).toStringAsFixed(1)} pts',
                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                            ),
                          ] else
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const SizedBox(
                                    width: 12, height: 12,
                                    child: CircularProgressIndicator(strokeWidth: 1.5),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text('Connecting to live prices...', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Trade info card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _infoRow('Price per trade', '\$$price'),
                          _infoRow('Lot Size', '${symbol['lotSize']}'),
                          _infoRow('Commission', '\$$commission'),
                          const Divider(),
                          _infoRow('Total Cost', '\$${totalCost.toStringAsFixed(2)}',
                              valueStyle: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFD4AF37), fontSize: 16)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Buy button - always visible
                  SizedBox(
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: isBuying
                          ? null
                          : () {
                              context.read<TradeBloc>().add(OpenTradeRequested(symbol['id']));
                            },
                      icon: isBuying
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.shopping_cart, color: Colors.white),
                      label: Text(
                        isBuying ? 'Opening Trade...' : 'Buy (\$${totalCost.toStringAsFixed(2)})',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD4AF37),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Open trades section
                  if (openTrades.isNotEmpty) ...[
                    Row(
                      children: [
                        const Icon(Icons.trending_up, size: 18, color: Colors.green),
                        const SizedBox(width: 8),
                        Text(
                          'Open Trades (${openTrades.length})',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...openTrades.map((trade) {
                      final tradeId = trade['id']?.toString() ?? '';
                      final openPrice = double.tryParse(trade['openPrice']?.toString() ?? '0') ?? 0;
                      final pnlData = tradeReady?.tradePnls[tradeId];
                      final currentPrice = pnlData?['currentPrice'] ?? liveBid;
                      final unrealizedPnl = pnlData?['unrealizedPnl'];

                      // Fallback P&L calculation from live bid
                      final displayPnl = unrealizedPnl ??
                          (currentPrice != null
                              ? (currentPrice - openPrice) * (double.tryParse(trade['lotSize']?.toString() ?? '1') ?? 1)
                              : null);

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Open @ \$${openPrice.toStringAsFixed(2)}',
                                        style: const TextStyle(fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Lot: ${trade['lotSize']}',
                                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                  if (displayPnl != null)
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${displayPnl >= 0 ? '+' : ''}\$${displayPnl.toStringAsFixed(2)}',
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            fontFamily: 'monospace',
                                            color: displayPnl >= 0 ? Colors.green : Colors.red,
                                          ),
                                        ),
                                        if (currentPrice != null)
                                          Text(
                                            'Now: \$${currentPrice.toStringAsFixed(2)}',
                                            style: const TextStyle(color: Colors.grey, fontSize: 11),
                                          ),
                                      ],
                                    ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              SizedBox(
                                width: double.infinity,
                                child: OutlinedButton.icon(
                                  onPressed: () {
                                    _showCloseConfirmation(context, tradeId, openPrice, displayPnl);
                                  },
                                  icon: const Icon(Icons.close, size: 16),
                                  label: const Text('Close Trade'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.red,
                                    side: const BorderSide(color: Colors.red),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ] else if (tradeReady != null) ...[
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.info_outline, size: 32, color: Colors.grey),
                          SizedBox(height: 8),
                          Text(
                            'No open trades for this symbol',
                            style: TextStyle(color: Colors.grey),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Tap Buy to open your first trade',
                            style: TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _showCloseConfirmation(BuildContext context, String tradeId, double openPrice, double? pnl) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Close Trade?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Open price: \$${openPrice.toStringAsFixed(2)}'),
            if (pnl != null) ...[
              const SizedBox(height: 8),
              Text(
                'Current P&L: ${pnl >= 0 ? '+' : ''}\$${pnl.toStringAsFixed(2)}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: pnl >= 0 ? Colors.green : Colors.red,
                ),
              ),
            ],
            const SizedBox(height: 12),
            const Text('Are you sure you want to close this trade?'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              context.read<TradeBloc>().add(CloseTradeRequested(tradeId));
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Close Trade', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, {TextStyle? valueStyle}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: valueStyle ?? const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
