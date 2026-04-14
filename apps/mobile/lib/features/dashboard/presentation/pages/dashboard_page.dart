import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import '../bloc/dashboard_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/network/websocket_client.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../l10n/app_localizations.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final WebSocketClient _wsClient = sl<WebSocketClient>();
  final ApiClient _apiClient = sl<ApiClient>();
  int _onlineCount = 0;
  StreamSubscription? _onlineSub;
  StreamSubscription? _priceSub;
  final Map<String, int> _symbolTradeMode = {};
  bool get _isMarketOpen => _symbolTradeMode.isNotEmpty && _symbolTradeMode.values.any((m) => m == 4);

  // Slideshow
  List<Map<String, dynamic>> _slides = [];
  int _currentSlide = 0;
  final PageController _pageController = PageController();
  Timer? _autoSlideTimer;

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
    _loadSlides();
  }

  Future<void> _openLink(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _resolveImageUrl(String url) {
    if (url.startsWith('http')) return url;
    return '${ApiConstants.host}$url';
  }

  Future<void> _loadSlides() async {
    try {
      final response = await _apiClient.dio.get('/slideshow');
      final data = response.data as List;
      setState(() {
        _slides = data.cast<Map<String, dynamic>>();
      });
      if (_slides.length > 1) {
        _autoSlideTimer = Timer.periodic(const Duration(seconds: 4), (_) {
          if (_pageController.hasClients) {
            final next = (_currentSlide + 1) % _slides.length;
            _pageController.animateToPage(next, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
          }
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _onlineSub?.cancel();
    _priceSub?.cancel();
    _autoSlideTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => sl<DashboardBloc>()..add(LoadDashboard()),
      child: Scaffold(
        appBar: AppBar(
          title: Text(t.tr('dashboard')),
          actions: [
            Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _onlineCount > 0 ? Colors.green.withOpacity(0.15) : Colors.grey.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7, height: 7,
                    decoration: BoxDecoration(
                      color: _onlineCount > 0 ? Colors.green : Colors.grey,
                      shape: BoxShape.circle,
                      boxShadow: _onlineCount > 0
                          ? [BoxShadow(color: Colors.green.withOpacity(0.5), blurRadius: 4)]
                          : null,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '$_onlineCount ${t.tr('online')}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _onlineCount > 0 ? Colors.green : Colors.grey,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
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
                  await _loadSlides();
                },
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_slides.isNotEmpty) ...[
                      _buildSlideshow(),
                      const SizedBox(height: 16),
                    ],
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

  Widget _buildSlideshow() {
    return Column(
      children: [
        SizedBox(
          height: 160,
          child: PageView.builder(
            controller: _pageController,
            itemCount: _slides.length,
            onPageChanged: (i) => setState(() => _currentSlide = i),
            itemBuilder: (context, index) {
              final slide = _slides[index];
              final hasTitle = slide['title'] != null && slide['title'].toString().isNotEmpty;
              final hasDesc = slide['description'] != null && slide['description'].toString().isNotEmpty;
              final link = slide['link']?.toString() ?? '';
              return GestureDetector(
                onTap: link.isNotEmpty ? () => _openLink(link) : null,
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFD4AF37).withOpacity(0.3)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.network(
                        _resolveImageUrl(slide['imageUrl'] ?? ''),
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: Theme.of(context).cardTheme.color,
                          child: const Center(child: Icon(Icons.image, color: Colors.grey, size: 40)),
                        ),
                      ),
                      if (hasTitle || hasDesc)
                        Positioned(
                          bottom: 0, left: 0, right: 0,
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.bottomCenter,
                                end: Alignment.topCenter,
                                colors: [Colors.black.withOpacity(0.7), Colors.transparent],
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (hasTitle)
                                  Text(
                                    slide['title'],
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                if (hasDesc)
                                  Text(
                                    slide['description'],
                                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 11),
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                  ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        if (_slides.length > 1) ...[
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_slides.length, (i) {
              return Container(
                width: _currentSlide == i ? 20 : 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  color: _currentSlide == i ? const Color(0xFFD4AF37) : Colors.grey.withOpacity(0.3),
                ),
              );
            }),
          ),
        ],
      ],
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
            Text(t.tr('accountBalance'),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey)),
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
