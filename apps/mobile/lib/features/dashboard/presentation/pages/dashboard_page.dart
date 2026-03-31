import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/dashboard_bloc.dart';
import '../../../../core/di/injection.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<DashboardBloc>()..add(LoadDashboard()),
      child: Scaffold(
        appBar: AppBar(title: const Text('Dashboard')),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Account Balance',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Colors.grey,
                    )),
            const SizedBox(height: 8),
            Text(
              '\$${state.balance.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPnlCard(BuildContext context, DashboardLoaded state) {
    final isProfit = state.monthlyPnl >= 0;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Monthly P&L',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: Colors.grey,
                    )),
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
              'Commission: \$${state.monthlyCommission.toStringAsFixed(2)}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow(DashboardLoaded state) {
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
                  const Text('Open Trades', style: TextStyle(color: Colors.grey)),
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
                  const Text('This Month', style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
