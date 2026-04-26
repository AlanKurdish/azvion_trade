import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/api_constants.dart';

class BlogDetailPage extends StatelessWidget {
  final Map<String, dynamic> post;
  const BlogDetailPage({super.key, required this.post});

  String _resolveImageUrl(String url) {
    if (url.isEmpty || url.startsWith('http')) return url;
    return '${ApiConstants.host}$url';
  }

  String _formatDate(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final raw = post['imageUrl']?.toString() ?? '';
    final imageUrl = _resolveImageUrl(raw);
    final title = post['title']?.toString() ?? '';
    final content = post['content']?.toString() ?? '';
    final published = DateTime.tryParse(post['publishedAt']?.toString() ?? '');

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // Collapsing hero image with title
          SliverAppBar(
            expandedHeight: imageUrl.isNotEmpty ? 280 : 100,
            pinned: true,
            stretch: true,
            backgroundColor: isDark ? const Color(0xFF0a0e1a) : Colors.white,
            iconTheme: const IconThemeData(color: Colors.white),
            flexibleSpace: FlexibleSpaceBar(
              stretchModes: const [StretchMode.zoomBackground, StretchMode.fadeTitle],
              background: imageUrl.isNotEmpty
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            color: const Color(0xFF1e293b),
                            child: const Center(child: Icon(Icons.image, color: Colors.grey, size: 60)),
                          ),
                        ),
                        // Dark gradient overlay so the back button + title stay legible
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.black54,
                                Colors.transparent,
                                Colors.transparent,
                                Colors.black87,
                              ],
                              stops: [0, 0.25, 0.55, 1],
                            ),
                          ),
                        ),
                      ],
                    )
                  : Container(
                      color: const Color(0xFFD4AF37).withValues(alpha: 0.1),
                    ),
            ),
          ),

          // Title block
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (published != null)
                    Row(
                      children: [
                        const Icon(Icons.calendar_today, size: 13, color: Color(0xFFD4AF37)),
                        const SizedBox(width: 6),
                        Text(
                          _formatDate(published),
                          style: const TextStyle(color: Color(0xFFD4AF37), fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  const SizedBox(height: 10),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      height: 1.25,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Gold underline accent
                  Container(
                    width: 50,
                    height: 3,
                    margin: const EdgeInsets.only(top: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD4AF37),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
              child: HtmlWidget(
                content,
                textStyle: TextStyle(
                  fontSize: 15,
                  height: 1.65,
                  color: isDark ? const Color(0xFFE5E7EB) : Colors.black87,
                ),
                baseUrl: Uri.parse(ApiConstants.host),
                onTapUrl: (url) async {
                  final uri = Uri.tryParse(url);
                  if (uri == null) return false;
                  return launchUrl(uri, mode: LaunchMode.externalApplication);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
