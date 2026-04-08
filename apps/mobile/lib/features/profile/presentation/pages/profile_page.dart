import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/profile_bloc.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../data/profile_datasource.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../main.dart';
import '../../../../l10n/language_provider.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return BlocProvider(
      create: (_) => sl<ProfileBloc>()..add(LoadProfile()),
      child: Scaffold(
        backgroundColor: const Color(0xFF0f172a),
        appBar: AppBar(
          title: Text(t.tr('profile')),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator(color: Color(0xFFD4AF37)));
            }
            if (state is ProfileLoaded || state is ProfileUpdated) {
              final profile = state is ProfileLoaded
                  ? state.profile
                  : (state as ProfileUpdated).profile;
              return _ProfileContent(profile: profile);
            }
            if (state is ProfileError) {
              return Center(child: Text(state.message, style: const TextStyle(color: Colors.red)));
            }
            return const SizedBox();
          },
        ),
      ),
    );
  }
}

class _ProfileContent extends StatelessWidget {
  final Map<String, dynamic> profile;
  const _ProfileContent({required this.profile});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final firstName = profile['firstName'] ?? '';
    final lastName = profile['lastName'] ?? '';
    final fullName = '$firstName $lastName'.trim();
    final phone = profile['phone'] ?? '';
    final balance = profile['balance']?['amount'];
    final initials = (firstName.isNotEmpty ? firstName[0] : '') +
        (lastName.isNotEmpty ? lastName[0] : '');

    return SingleChildScrollView(
      child: Column(
        children: [
          // Header with avatar
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF1e293b), Color(0xFF0f172a)],
              ),
            ),
            child: Column(
              children: [
                // Avatar
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
                  child: Center(
                    child: Text(
                      initials.isNotEmpty ? initials.toUpperCase() : '?',
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  fullName.isNotEmpty ? fullName : t.tr('profile'),
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(phone, style: TextStyle(fontSize: 14, color: Colors.grey[500])),
                const SizedBox(height: 20),
                // Balance card
                if (balance != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1e293b),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFD4AF37).withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD4AF37).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.account_balance_wallet, color: Color(0xFFD4AF37), size: 20),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(t.tr('balance'), style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                            const SizedBox(height: 2),
                            Text(
                              '\$$balance',
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFD4AF37),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          // Menu sections
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                // Account section
                _SectionCard(
                  children: [
                    _MenuItem(
                      icon: Icons.person_outline,
                      title: t.tr('editProfile'),
                      subtitle: t.tr('updateName'),
                      onTap: () => _showEditSheet(context, profile),
                    ),
                    const _Divider(),
                    _MenuItem(
                      icon: Icons.phone_outlined,
                      title: t.tr('phoneLabel'),
                      subtitle: phone,
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(t.tr('verified'), style: const TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // App section
                _SectionCard(
                  children: [
                    _MenuItem(
                      icon: Icons.shield_outlined,
                      title: t.tr('privacyPolicy'),
                      onTap: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const _PrivacyPolicyPage()));
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

                const SizedBox(height: 12),

                // Language section
                _SectionCard(
                  children: [
                    _MenuItem(
                      icon: Icons.language,
                      title: 'English',
                      onTap: () {
                        languageProvider.setLocale(const Locale('en'));
                      },
                    ),
                    const _Divider(),
                    _MenuItem(
                      icon: Icons.language,
                      title: 'العربية',
                      onTap: () {
                        languageProvider.setLocale(const Locale('ar'));
                      },
                    ),
                    const _Divider(),
                    _MenuItem(
                      icon: Icons.language,
                      title: 'کوردی',
                      onTap: () {
                        languageProvider.setLocale(const Locale('ckb'));
                      },
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Logout
                _SectionCard(
                  children: [
                    _MenuItem(
                      icon: Icons.logout,
                      title: t.tr('logout'),
                      iconColor: Colors.red,
                      titleColor: Colors.red,
                      onTap: () {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: const Color(0xFF1e293b),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            title: Text(t.tr('logout')),
                            content: Text(t.tr('logoutConfirm')),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: Text(t.tr('cancel'), style: TextStyle(color: Colors.grey[400])),
                              ),
                              ElevatedButton(
                                onPressed: () {
                                  Navigator.pop(ctx);
                                  context.read<AuthBloc>().add(AuthLogoutRequested());
                                },
                                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                                child: Text(t.tr('logout'), style: const TextStyle(color: Colors.white)),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showEditSheet(BuildContext context, Map<String, dynamic> profile) {
    final t = AppLocalizations.of(context);
    final firstNameCtrl = TextEditingController(text: profile['firstName'] ?? '');
    final lastNameCtrl = TextEditingController(text: profile['lastName'] ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
        decoration: const BoxDecoration(
          color: Color(0xFF1e293b),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey[700], borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 20),
            Text(t.tr('editProfile'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            _EditField(controller: firstNameCtrl, label: t.tr('firstName'), icon: Icons.person_outline),
            const SizedBox(height: 14),
            _EditField(controller: lastNameCtrl, label: t.tr('lastName'), icon: Icons.person_outline),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: BorderSide(color: Colors.grey[700]!),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(t.tr('cancel'), style: TextStyle(color: Colors.grey[400])),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      context.read<ProfileBloc>().add(UpdateProfile(
                        firstName: firstNameCtrl.text.trim(),
                        lastName: lastNameCtrl.text.trim(),
                      ));
                      Navigator.pop(ctx);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD4AF37),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(t.tr('save'), style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EditField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  const _EditField({required this.controller, required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.grey[500]),
        prefixIcon: Icon(icon, color: const Color(0xFFD4AF37), size: 20),
        filled: true,
        fillColor: const Color(0xFF0f172a),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD4AF37)),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final List<Widget> children;
  const _SectionCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1e293b),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(children: children),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? iconColor;
  final Color? titleColor;

  const _MenuItem({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.iconColor,
    this.titleColor,
  });

  @override
  Widget build(BuildContext context) {
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
                color: (iconColor ?? const Color(0xFFD4AF37)).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor ?? const Color(0xFFD4AF37), size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: titleColor ?? Colors.white, fontSize: 15)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                  ],
                ],
              ),
            ),
            if (trailing != null)
              trailing!
            else if (onTap != null)
              Icon(Icons.chevron_right, color: Colors.grey[700], size: 20),
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Divider(height: 1, color: Colors.grey[800]),
    );
  }
}

class _PrivacyPolicyPage extends StatelessWidget {
  const _PrivacyPolicyPage();

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFF0f172a),
      appBar: AppBar(title: Text(t.tr('privacyPolicy')), backgroundColor: Colors.transparent, elevation: 0),
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
              style: TextStyle(color: Colors.grey[300], height: 1.6),
            ),
          );
        },
      ),
    );
  }
}
