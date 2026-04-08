import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/dashboard_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/network/websocket_client.dart';
import '../../../../l10n/app_localizations.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final WebSocketClient _wsClient = sl<WebSocketClient>();
  int _onlineCount = 0;
  StreamSubscription? _onlineSub;
  StreamSubscription? _priceSub;
  // Track market status per symbol: true = open (tradeMode == 4)
  final Map<String, int> _symbolTradeMode = {};
  bool get _isMarketOpen => _symbolTradeMode.isNotEmpty && _symbolTradeMode.values.any((m) => m == 4);

  @override
  void initState() {
    super.initState();
    _onlineSub = _wsClient.on('online:count').listen((data) {
      if (data is Map && data['count'] != null) {
        setState(() => _onlineCount = data['count'] as int);
      }
    });
    _priceSub = _wsClient.on('price:update').listen((data) {
      if (data is Map<String, dynamic> && data['symbol'] != null && data['tradeMode'] != null) {
        setState(() {
          _symbolTradeMode[data['symbol'] as String] = (data['tradeMode'] as num).toInt();
        });
      }
    });
  }

  @override
  void dispose() {
    _onlineSub?.cancel();
    _priceSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => sl<DashboardBloc>()..add(LoadDashboard()),
      child: Scaffold(
        appBar: AppBar(title: Text(t.tr('dashboard'))),
        body: BlocBuilder<DashboardBloc, DashboardState>(
          builder: (context, state) {
            if (state is DashboardLoading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state is DashboardError) {
              return Center(child: Text(state.message));
            }
            if (state is DashboardLoaded) {
              return RefreshIndicator(
                onRefresh: () async {
                  context.read<DashboardBloc>().add(LoadDashboard());
                },
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildMarketStatusCard(),
                    const SizedBox(height: 16),
                    _buildBalanceCard(context, state),
                    const SizedBox(height: 16),
                    _buildPnlCard(context, state),
                    const SizedBox(height: 16),
                    _buildStatsRow(state),
                  ],
                ),
              );
            }
            return const SizedBox();
          },
        ),
      ),
    );
  }

  Widget _buildBalanceCard(BuildContext context, DashboardLoaded state) {
    final t = AppLocalizations.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(t.tr('accountBalance'),
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey)),
                // Online users indicator
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _onlineCount > 0 ? Colors.green.withOpacity(0.1) : Colors.grey.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6, height: 6,
                        decoration: BoxDecoration(
                          color: _onlineCount > 0 ? Colors.green : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '$_onlineCount ${t.tr('online')}',
                        style: TextStyle(
                          fontSize: 11,
                          color: _onlineCount > 0 ? Colors.green : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '\$${state.balance.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPnlCard(BuildContext context, DashboardLoaded state) {
    final t = AppLocalizations.of(context);
    final isProfit = state.monthlyPnl >= 0;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.tr('monthlyPnl'),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey)),
            const SizedBox(height: 8),
            Text(
              '${isProfit ? '+' : ''}\$${state.monthlyPnl.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: isProfit ? Colors.green : Colors.red,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '${t.tr('commission')}: \$${state.monthlyCommission.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  String _tradeModeText(int mode, AppLocalizations t) {
    switch (mode) {
      case 0: return t.tr('modeDisabled');
      case 1: return t.tr('modeLongOnly');
      case 2: return t.tr('modeShortOnly');
      case 3: return t.tr('modeCloseOnly');
      case 4: return t.tr('modeOpen');
      default: return t.tr('modeUnknown');
    }
  }

  Widget _buildMarketStatusCard() {
    final t = AppLocalizations.of(context);
    final isOpen = _isMarketOpen;
    return Card(
      color: isOpen ? Colors.green.withOpacity(0.05) : Colors.red.withOpacity(0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isOpen ? Colors.green.withOpacity(0.3) : Colors.red.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(
                    color: isOpen ? Colors.green : Colors.red,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: (isOpen ? Colors.green : Colors.red).withOpacity(0.5), blurRadius: 6)],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  isOpen ? t.tr('marketOpen') : t.tr('marketClosed'),
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isOpen ? Colors.green : Colors.red,
                  ),
                ),
              ],
            ),
            if (_symbolTradeMode.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _symbolTradeMode.entries.map((e) {
                  final open = e.value == 4;
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: open ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6, height: 6,
                          decoration: BoxDecoration(
                            color: open ? Colors.green : Colors.red,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          e.key.replaceAll('.ecn', ''),
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: open ? Colors.green : Colors.red),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _tradeModeText(e.value, t),
                          style: TextStyle(fontSize: 10, color: open ? Colors.green.withOpacity(0.7) : Colors.red.withOpacity(0.7)),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ] else
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(t.tr('waitingMarketData'), style: const TextStyle(color: Colors.grey, fontSize: 12)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow(DashboardLoaded state) {
    final t = AppLocalizations.of(context);
    return Row(
      children: [
        Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Icon(Icons.trending_up, color: Color(0xFFD4AF37)),
                  const SizedBox(height: 8),
                  Text('${state.openTradesCount}',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  Text(t.tr('openTrades'), style: const TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Icon(Icons.history, color: Color(0xFFD4AF37)),
                  const SizedBox(height: 8),
                  Text('${state.closedTradesCount}',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  Text(t.tr('thisMonth'), style: const TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
