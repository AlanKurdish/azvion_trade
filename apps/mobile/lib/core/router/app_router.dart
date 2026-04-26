import 'dart:async';
import 'package:flutter/material.dart';
import '../di/injection.dart';
import '../network/websocket_client.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/trade/presentation/pages/symbols_page.dart';
import '../../features/positions/presentation/pages/positions_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/blog/presentation/blog_page.dart';
import '../../l10n/app_localizations.dart';

// Global key to control tab switching from anywhere
final mainShellKey = GlobalKey<MainShellState>();

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => MainShellState();
}

class MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _currentIndex = 0;
  final WebSocketClient _wsClient = sl<WebSocketClient>();
  StreamSubscription? _tradeOpenedSub;
  StreamSubscription? _tradeClosedSub;
  StreamSubscription? _balanceSub;

  // Keys to refresh child pages
  final _dashboardKey = GlobalKey();
  final _positionsKey = GlobalKey();
  final _profileKey = GlobalKey();

  // Rebuild counters to force page refresh
  int _dashboardRefresh = 0;
  int _positionsRefresh = 0;
  int _profileRefresh = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Reconnect WebSocket with auth token
    _wsClient.disconnect();
    _wsClient.connect();

    // When a trade is opened, switch to positions tab and refresh
    _tradeOpenedSub = _wsClient.on('trade:opened').listen((_) {
      setState(() {
        _currentIndex = 2; // Switch to Positions tab
        _positionsRefresh++;
        _dashboardRefresh++;
        _profileRefresh++;
      });
    });

    // When a trade is closed, refresh positions, dashboard, and profile
    _tradeClosedSub = _wsClient.on('trade:closed').listen((_) {
      setState(() {
        _positionsRefresh++;
        _dashboardRefresh++;
        _profileRefresh++;
      });
    });

    // When balance updates, refresh dashboard and profile
    _balanceSub = _wsClient.on('balance:updated').listen((_) {
      setState(() {
        _dashboardRefresh++;
        _profileRefresh++;
      });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tradeOpenedSub?.cancel();
    _tradeClosedSub?.cancel();
    _balanceSub?.cancel();
    super.dispose();
  }

  /// Resume the WebSocket whenever the app comes back from background.
  /// Android often pauses or kills the underlying socket after a long
  /// idle period; the built-in 50-attempt auto-reconnect will have given
  /// up by then, so we kick it back to life manually here.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      if (!_wsClient.isConnected) {
        // ignore: avoid_print
        print('[lifecycle] resumed → WS not connected, reconnecting');
        _wsClient.connect();
      }
      // Force a UI refresh so children fetch fresh data after resume
      if (mounted) {
        setState(() {
          _dashboardRefresh++;
          _positionsRefresh++;
        });
      }
    }
  }

  /// Switch to a specific tab programmatically
  void switchToTab(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          DashboardPage(key: ValueKey('dash_$_dashboardRefresh')),
          const SymbolsPage(),
          PositionsPage(key: ValueKey('pos_$_positionsRefresh')),
          const BlogPage(),
          ProfilePage(key: ValueKey('prof_$_profileRefresh')),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: [
          BottomNavigationBarItem(icon: const Icon(Icons.dashboard), label: AppLocalizations.of(context).tr('navDashboard')),
          BottomNavigationBarItem(icon: const Icon(Icons.candlestick_chart), label: AppLocalizations.of(context).tr('navTrade')),
          BottomNavigationBarItem(icon: const Icon(Icons.receipt_long), label: AppLocalizations.of(context).tr('navPositions')),
          BottomNavigationBarItem(icon: const Icon(Icons.article), label: AppLocalizations.of(context).tr('navBlog')),
          BottomNavigationBarItem(icon: const Icon(Icons.person), label: AppLocalizations.of(context).tr('navProfile')),
        ],
      ),
    );
  }
}
