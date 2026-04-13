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
        bloc.subscribeToPriceStream(mtSymbol, symbolId: symbolId);
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
    final commission = double.tryParse(symbol['commission'].toString()) ?? 0;

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
            final liveFormulaPrice = tradeReady?.liveFormulaPrice;
            final isBuying = tradeReady?.isBuying ?? false;
            final hasFormula = liveFormulaPrice != null;

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

                          // Live price display — formula result only
                          if (hasFormula || liveBid != null || liveAsk != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                children: [
                                  Text(AppLocalizations.of(context).tr('livePrice'), style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                  const SizedBox(height: 8),
                                  Text(
                                    formatPrice(liveFormulaPrice ?? liveAsk ?? liveBid ?? 0),
                                    style: const TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFFD4AF37),
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                ],
                              ),
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

                  // Trade info card — uses live formula price
                  Builder(builder: (context) {
                    final livePrice = liveFormulaPrice ?? 0.0;
                    final liveTotalCost = livePrice + commission;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              children: [
                                _infoRow(AppLocalizations.of(context).tr('price'),
                                    liveFormulaPrice != null ? '\$${formatPrice(livePrice)}' : '...'),
                                _infoRow(AppLocalizations.of(context).tr('commission'), '\$${commission.toStringAsFixed(2)}'),
                                const Divider(),
                                _infoRow(AppLocalizations.of(context).tr('totalCost'),
                                    liveFormulaPrice != null ? '\$${liveTotalCost.toStringAsFixed(2)}' : '...',
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
                            onPressed: (isBuying || liveFormulaPrice == null)
                                ? null
                                : () {
                                    context.read<TradeBloc>().add(OpenTradeRequested(symbol['id']));
                                  },
                            icon: isBuying
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.shopping_cart, color: Colors.white),
                            label: Text(
                              isBuying
                                  ? AppLocalizations.of(context).tr('openingTrade')
                                  : liveFormulaPrice != null
                                      ? '${AppLocalizations.of(context).tr('buy')} (\$${liveTotalCost.toStringAsFixed(2)})'
                                      : AppLocalizations.of(context).tr('waitingPrice'),
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD4AF37),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
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
