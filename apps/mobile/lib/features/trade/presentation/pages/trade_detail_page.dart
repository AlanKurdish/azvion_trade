import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/trade_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/router/app_router.dart';
import '../../../../l10n/app_localizations.dart';

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
        return bloc;
      },
      child: _TradeDetailView(symbol: symbol),
    );
  }
}

class _TradeDetailView extends StatelessWidget {
  final Map<String, dynamic> symbol;
  const _TradeDetailView({required this.symbol});

  /// Smart decimal formatting based on price magnitude
  String formatPrice(double price) {
    if (price == 0) return '0';
    if (price >= 1000) return price.toStringAsFixed(2);
    if (price >= 10) return price.toStringAsFixed(3);
    if (price >= 1) return price.toStringAsFixed(4);
    return price.toStringAsFixed(5);
  }

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
                // Navigate back and switch to Positions tab
                if (state.successMessage!.contains('opened') || state.successMessage!.contains('سەرکەوتوویی') || state.successMessage!.contains('بنجاح')) {
                  Navigator.pop(context, true);
                  mainShellKey.currentState?.switchToTab(2);
                }
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
                                        formatPrice(liveBid),
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
                                        formatPrice(liveAsk),
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
                              'Spread: ${formatPrice(liveAsk - liveBid)}',
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
                          _infoRow(AppLocalizations.of(context).tr('price'), '\$$price'),
                          _infoRow(AppLocalizations.of(context).tr('commission'), '\$$commission'),
                          const Divider(),
                          _infoRow(AppLocalizations.of(context).tr('totalCost'), '\$${totalCost.toStringAsFixed(2)}',
                              valueStyle: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFD4AF37), fontSize: 16)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Buy button
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
                        isBuying ? AppLocalizations.of(context).tr('openingTrade') : '${AppLocalizations.of(context).tr('buy')} (\$${totalCost.toStringAsFixed(2)})',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD4AF37),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline, size: 16, color: Colors.grey),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            AppLocalizations.of(context).tr('viewPositions'),
                            style: const TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
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
