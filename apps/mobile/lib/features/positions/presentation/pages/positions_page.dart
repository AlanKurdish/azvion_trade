import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/positions_bloc.dart';
import '../../../../core/di/injection.dart';

class PositionsPage extends StatefulWidget {
  const PositionsPage({super.key});

  @override
  State<PositionsPage> createState() => _PositionsPageState();
}

class _PositionsPageState extends State<PositionsPage> with SingleTickerProviderStateMixin {
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
    return BlocProvider(
      create: (_) => sl<PositionsBloc>()..add(LoadOpenPositions()),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Positions'),
          bottom: TabBar(
            controller: _tabController,
            indicatorColor: const Color(0xFFD4AF37),
            tabs: const [
              Tab(text: 'Open'),
              Tab(text: 'History'),
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
      ),
    );
  }
}

class _OpenPositionsTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PositionsBloc, PositionsState>(
      builder: (context, state) {
        if (state is PositionsLoading) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state is OpenPositionsLoaded) {
          if (state.positions.isEmpty) {
            return const Center(child: Text('No open positions'));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: state.positions.length,
            itemBuilder: (context, index) {
              final trade = state.positions[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  title: Text(
                    trade['symbol']?['displayName'] ?? 'Unknown',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    'Open: \$${trade['openPrice']} | Lot: ${trade['lotSize']}',
                    style: const TextStyle(color: Colors.grey),
                  ),
                  trailing: const Icon(Icons.fiber_manual_record, color: Colors.green, size: 12),
                ),
              );
            },
          );
        }
        return const SizedBox();
      },
    );
  }
}

class _HistoryTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PositionsBloc, PositionsState>(
      builder: (context, state) {
        if (state is PositionsLoading) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state is HistoryLoaded) {
          if (state.trades.isEmpty) {
            return const Center(child: Text('No trade history'));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: state.trades.length,
            itemBuilder: (context, index) {
              final trade = state.trades[index];
              final pnl = double.tryParse(trade['profitLoss']?.toString() ?? '0') ?? 0;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  title: Text(
                    trade['symbol']?['displayName'] ?? 'Unknown',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    'Open: \$${trade['openPrice']} → Close: \$${trade['closePrice']}',
                    style: const TextStyle(color: Colors.grey),
                  ),
                  trailing: Text(
                    '${pnl >= 0 ? '+' : ''}\$${pnl.toStringAsFixed(2)}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: pnl >= 0 ? Colors.green : Colors.red,
                    ),
                  ),
                ),
              );
            },
          );
        }
        return const SizedBox();
      },
    );
  }
}
