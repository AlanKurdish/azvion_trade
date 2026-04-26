import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/di/injection.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../l10n/app_localizations.dart';

class BlogPage extends StatefulWidget {
  const BlogPage({super.key});
  @override
  State<BlogPage> createState() => _BlogPageState();
}

class _BlogPageState extends State<BlogPage> {
  final ApiClient _api = sl<ApiClient>();
  bool _loading = true;
  bool _subscribed = false;
  DateTime? _expiresAt;
  double _price = 0;
  List<dynamic> _posts = [];
  bool _buying = false;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final status = await _api.dio.get(ApiConstants.subscriptionStatus);
      _subscribed = status.data['active'] == true;
      _expiresAt = status.data['expiresAt'] != null
          ? DateTime.tryParse(status.data['expiresAt'].toString())
          : null;
      _price = double.tryParse((status.data['price'] ?? 0).toString()) ?? 0;
      if (_subscribed) {
        try {
          final posts = await _api.dio.get(ApiConstants.blog);
          _posts = posts.data as List<dynamic>;
        } catch (_) {
          _posts = [];
        }
      }
    } catch (_) {
      _subscribed = false;
      _expiresAt = null;
      _price = 0;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _subscribe() async {
    setState(() => _buying = true);
    try {
      await _api.dio.post(ApiConstants.subscriptionBuy);
      await _load();
    } catch (e) {
      if (!mounted) return;
      String msg = 'Failed';
      try {
        msg = (e as dynamic).response?.data?['message']?.toString() ?? 'Failed';
      } catch (_) {}
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _buying = false);
    }
  }

  String _remaining() {
    if (_expiresAt == null) return '—';
    final ms = _expiresAt!.difference(DateTime.now()).inMinutes;
    if (ms <= 0) return 'expired';
    final d = ms ~/ (60 * 24);
    final h = (ms % (60 * 24)) ~/ 60;
    if (d > 0) return '${d}d ${h}h';
    return '${h}h';
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t.tr('blogTitle'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFD4AF37)))
          : RefreshIndicator(
              onRefresh: _load,
              child: !_subscribed
                  ? _buildSubscribeWall(t)
                  : _buildPostsList(t),
            ),
    );
  }

  Widget _buildSubscribeWall(AppLocalizations t) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 60),
      children: [
        const Icon(Icons.article_outlined, size: 80, color: Color(0xFFD4AF37)),
        const SizedBox(height: 16),
        Text(t.tr('subscribeRequired'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 24),
        if (_price > 0) ...[
          Text(
            '${t.tr('subscribePrice')} \$${_price.toStringAsFixed(2)} / month',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFFD4AF37), fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _buying ? null : _subscribe,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD4AF37),
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 30),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _buying
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                : Text(t.tr('subscribeButton'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
        ] else
          Text(t.tr('noCardsAvailable'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey)),
      ],
    );
  }

  Widget _buildPostsList(AppLocalizations t) {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // Subscription status banner
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFD4AF37).withValues(alpha: 0.08),
            border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.3)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(Icons.verified, color: Color(0xFFD4AF37), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  t.tr('subscriptionActive'),
                  style: const TextStyle(color: Color(0xFFD4AF37), fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
              const Icon(Icons.access_time, size: 14, color: Colors.grey),
              const SizedBox(width: 4),
              Text('${t.tr('subscriptionExpires')} ${_remaining()}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
        ),

        if (_posts.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 40),
            child: Center(child: Text(t.tr('noPosts'), style: const TextStyle(color: Colors.grey))),
          )
        else
          ..._posts.map((p) => _PostCard(post: p as Map<String, dynamic>)),
      ],
    );
  }
}

class _PostCard extends StatelessWidget {
  final Map<String, dynamic> post;
  const _PostCard({required this.post});

  @override
  Widget build(BuildContext context) {
    final imageUrl = post['imageUrl']?.toString();
    final published = DateTime.tryParse(post['publishedAt']?.toString() ?? '');
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (imageUrl != null && imageUrl.isNotEmpty)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(color: Colors.black12, child: const Center(child: Icon(Icons.image, color: Colors.grey))),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(post['title']?.toString() ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                if (published != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '${published.year}-${published.month.toString().padLeft(2, '0')}-${published.day.toString().padLeft(2, '0')}',
                    style: const TextStyle(color: Colors.grey, fontSize: 11),
                  ),
                ],
                const SizedBox(height: 10),
                HtmlWidget(
                  post['content']?.toString() ?? '',
                  textStyle: const TextStyle(fontSize: 14, height: 1.55),
                  onTapUrl: (url) async {
                    final uri = Uri.tryParse(url);
                    if (uri == null) return false;
                    return launchUrl(uri, mode: LaunchMode.externalApplication);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
