import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/di/injection.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../l10n/app_localizations.dart';
import 'blog_detail_page.dart';

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
  double _balance = 0;
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
      // Load balance for the subscribe-confirmation modal
      try {
        final bal = await _api.dio.get(ApiConstants.balance);
        _balance = double.tryParse((bal.data['amount'] ?? 0).toString()) ?? 0;
      } catch (_) {}
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

  /// Confirmation modal before subscribing
  Future<bool> _showSubscribeModal() async {
    final t = AppLocalizations.of(context);
    final newBalance = _balance - _price;
    final notEnough = _balance < _price;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(ctx).cardTheme.color,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + MediaQuery.of(ctx).viewPadding.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey[700], borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 16),
              const Icon(Icons.article, size: 44, color: Color(0xFFD4AF37)),
              const SizedBox(height: 10),
              Text(
                t.tr('subscribeConfirm'),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
              ),
              const SizedBox(height: 6),
              Text(
                t.tr('subscribeIntro'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 18),
              _row(t.tr('balance'), '\$${_balance.toStringAsFixed(2)}'),
              _row('${t.tr('subscribeFor')} (${t.tr('monthly')})', '-\$${_price.toStringAsFixed(2)}', valueColor: Colors.red),
              const Divider(height: 24),
              _row(t.tr('newBalance'), '\$${newBalance.toStringAsFixed(2)}', valueColor: const Color(0xFFD4AF37), bold: true),
              if (notEnough) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber, color: Colors.red, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          t.tr('insufficientBalance'),
                          style: const TextStyle(color: Colors.red, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: BorderSide(color: Colors.grey[600]!),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(t.tr('cancel')),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: notEnough ? null : () => Navigator.pop(ctx, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD4AF37),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        disabledBackgroundColor: Colors.grey[800],
                      ),
                      child: Text(
                        '${t.tr('confirm')} • \$${_price.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
    return confirmed == true;
  }

  Widget _row(String label, String value, {Color? valueColor, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13))),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.w600,
              fontSize: bold ? 17 : 14,
              color: valueColor,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _subscribe() async {
    final confirmed = await _showSubscribeModal();
    if (!confirmed) return;
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
    if (_posts.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SubscriptionBanner(remaining: _remaining()),
          const SizedBox(height: 60),
          Center(child: Text(t.tr('noPosts'), style: const TextStyle(color: Colors.grey, fontSize: 15))),
        ],
      );
    }

    final featured = _posts.first as Map<String, dynamic>;
    final rest = _posts.sublist(1).cast<Map<String, dynamic>>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _SubscriptionBanner(remaining: _remaining()),
        const SizedBox(height: 18),
        // Featured (large) card
        _FeaturedPostCard(post: featured),
        if (rest.isNotEmpty) ...[
          const SizedBox(height: 22),
          Row(
            children: [
              Container(
                width: 4, height: 18,
                decoration: BoxDecoration(
                  color: const Color(0xFFD4AF37),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 10),
              const Text('More posts', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 12),
          ...rest.map((p) => _CompactPostCard(post: p)),
        ],
      ],
    );
  }
}

// ─── Modern blog card components ──────────────────────────────────────

String _resolveImageUrl(String url) {
  if (url.isEmpty || url.startsWith('http')) return url;
  return '${ApiConstants.host}$url';
}

String _excerpt(String html, int maxChars) {
  // Strip tags + collapse whitespace for the preview snippet
  final stripped = html.replaceAll(RegExp(r'<[^>]*>'), ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
  if (stripped.length <= maxChars) return stripped;
  return '${stripped.substring(0, maxChars).trimRight()}…';
}

String _shortDate(DateTime d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.day}';
}

void _openDetail(BuildContext context, Map<String, dynamic> post) {
  Navigator.push(
    context,
    MaterialPageRoute(builder: (_) => BlogDetailPage(post: post)),
  );
}

class _SubscriptionBanner extends StatelessWidget {
  final String remaining;
  const _SubscriptionBanner({required this.remaining});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
          const Icon(Icons.access_time, size: 13, color: Colors.grey),
          const SizedBox(width: 4),
          Text('${t.tr('subscriptionExpires')} $remaining', style: const TextStyle(color: Colors.grey, fontSize: 12)),
        ],
      ),
    );
  }
}

/// Big hero-style card for the most-recent post. Tap → detail page.
class _FeaturedPostCard extends StatelessWidget {
  final Map<String, dynamic> post;
  const _FeaturedPostCard({required this.post});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final imageUrl = _resolveImageUrl(post['imageUrl']?.toString() ?? '');
    final title = post['title']?.toString() ?? '';
    final excerpt = _excerpt(post['content']?.toString() ?? '', 130);
    final published = DateTime.tryParse(post['publishedAt']?.toString() ?? '');

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openDetail(context, post),
        child: Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1e293b) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE5E7EB)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.08),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (imageUrl.isNotEmpty)
                Stack(
                  children: [
                    AspectRatio(
                      aspectRatio: 16 / 9,
                      child: Image.network(
                        imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: Colors.black12,
                          child: const Center(child: Icon(Icons.image, color: Colors.grey, size: 40)),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 12, left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD4AF37),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star, size: 12, color: Colors.black),
                            SizedBox(width: 4),
                            Text('Featured', style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (published != null) ...[
                      Row(
                        children: [
                          const Icon(Icons.calendar_today, size: 12, color: Color(0xFFD4AF37)),
                          const SizedBox(width: 5),
                          Text(_shortDate(published), style: const TextStyle(color: Color(0xFFD4AF37), fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.bold,
                        height: 1.3,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    if (excerpt.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        excerpt,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.5,
                          color: Colors.grey[isDark ? 400 : 700],
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Text('Read article', style: TextStyle(color: const Color(0xFFD4AF37), fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward, size: 14, color: Color(0xFFD4AF37)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact horizontal card: thumbnail + title + date on the right.
class _CompactPostCard extends StatelessWidget {
  final Map<String, dynamic> post;
  const _CompactPostCard({required this.post});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final imageUrl = _resolveImageUrl(post['imageUrl']?.toString() ?? '');
    final title = post['title']?.toString() ?? '';
    final excerpt = _excerpt(post['content']?.toString() ?? '', 75);
    final published = DateTime.tryParse(post['publishedAt']?.toString() ?? '');

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _openDetail(context, post),
          child: Container(
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1e293b) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE5E7EB)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Thumbnail
                SizedBox(
                  width: 110,
                  child: imageUrl.isEmpty
                      ? Container(
                          color: const Color(0xFFD4AF37).withValues(alpha: 0.1),
                          child: const Center(child: Icon(Icons.article, color: Color(0xFFD4AF37), size: 28)),
                        )
                      : Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            color: Colors.black12,
                            child: const Center(child: Icon(Icons.image, color: Colors.grey)),
                          ),
                        ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                height: 1.25,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            if (excerpt.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                excerpt,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 11, color: Colors.grey[isDark ? 500 : 600], height: 1.4),
                              ),
                            ],
                          ],
                        ),
                        if (published != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Row(
                              children: [
                                const Icon(Icons.calendar_today, size: 11, color: Color(0xFFD4AF37)),
                                const SizedBox(width: 4),
                                Text(
                                  _shortDate(published),
                                  style: const TextStyle(color: Color(0xFFD4AF37), fontSize: 10, fontWeight: FontWeight.w600),
                                ),
                                const Spacer(),
                                const Icon(Icons.arrow_forward_ios, size: 11, color: Colors.grey),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
