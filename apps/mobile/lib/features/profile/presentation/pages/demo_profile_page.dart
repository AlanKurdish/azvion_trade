import 'package:flutter/material.dart';
import '../../../../core/di/injection.dart';
import '../../data/profile_datasource.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../main.dart';

/// Profile page shown when the backend has toggled demo mode on.
/// No login, no balance, no edit — only theme, language, privacy policy, version.
class DemoProfilePage extends StatelessWidget {
  const DemoProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: Text(t.tr('profile')), elevation: 0),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Simple branded header (no account info)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: isDark
                      ? [const Color(0xFF1e293b), const Color(0xFF0f172a)]
                      : [const Color(0xFFF8F9FA), const Color(0xFFF0F0F0)],
                ),
              ),
              child: Column(
                children: [
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFFD4AF37), Color(0xFFc5a030)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFD4AF37).withOpacity(0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(Icons.candlestick_chart, size: 40, color: Colors.black),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    t.tr('appName'),
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  // Theme toggle
                  _SectionCard(children: [const _ThemeToggleItem()]),
                  const SizedBox(height: 12),

                  // Language
                  _SectionCard(
                    children: [
                      _MenuItem(
                        icon: Icons.language,
                        title: 'English',
                        onTap: () => languageProvider.setLocale(const Locale('en')),
                      ),
                      const _Divider(),
                      _MenuItem(
                        icon: Icons.language,
                        title: 'العربية',
                        onTap: () => languageProvider.setLocale(const Locale('ar')),
                      ),
                      const _Divider(),
                      _MenuItem(
                        icon: Icons.language,
                        title: 'کوردی',
                        onTap: () => languageProvider.setLocale(const Locale('ckb')),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Privacy Policy + Version
                  _SectionCard(
                    children: [
                      _MenuItem(
                        icon: Icons.shield_outlined,
                        title: t.tr('privacyPolicy'),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const _PrivacyPolicyPage()),
                          );
                        },
                      ),
                      const _Divider(),
                      _MenuItem(
                        icon: Icons.info_outline,
                        title: t.tr('appVersion'),
                        trailing: Text('1.0.0', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                      ),
                    ],
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// --- Shared helpers (minimal copies so demo page is self-contained) ---

class _ThemeToggleItem extends StatelessWidget {
  const _ThemeToggleItem();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final t = AppLocalizations.of(context);
    return InkWell(
      onTap: () {
        themeNotifier.value = isDark ? ThemeMode.light : ThemeMode.dark;
      },
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFD4AF37).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isDark ? Icons.dark_mode : Icons.light_mode,
                color: const Color(0xFFD4AF37),
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                t.tr('theme'),
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 15,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.1) : Colors.black.withOpacity(0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                isDark ? t.tr('dark') : t.tr('light'),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final List<Widget> children;
  const _SectionCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1e293b) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE5E7EB)),
      ),
      child: Column(children: children),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _MenuItem({
    required this.icon,
    required this.title,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFD4AF37).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: const Color(0xFFD4AF37), size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 15,
                ),
              ),
            ),
            if (trailing != null)
              trailing!
            else if (onTap != null)
              Icon(Icons.chevron_right, color: Colors.grey[isDark ? 700 : 400], size: 20),
          ],
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Divider(height: 1, color: isDark ? Colors.grey[800] : Colors.grey[300]),
    );
  }
}

class _PrivacyPolicyPage extends StatelessWidget {
  const _PrivacyPolicyPage();

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t.tr('privacyPolicy')), elevation: 0),
      body: FutureBuilder<String>(
        future: sl<ProfileDatasource>().getPrivacyPolicy(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFFD4AF37)));
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Text(
              snapshot.data ?? t.tr('noPrivacyPolicy'),
              style: TextStyle(
                color: Colors.grey[Theme.of(context).brightness == Brightness.dark ? 300 : 700],
                height: 1.6,
              ),
            ),
          );
        },
      ),
    );
  }
}
