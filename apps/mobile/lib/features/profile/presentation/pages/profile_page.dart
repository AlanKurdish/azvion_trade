import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/profile_bloc.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../../core/di/injection.dart';
import '../../data/profile_datasource.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ProfileBloc>()..add(LoadProfile()),
      child: Scaffold(
        appBar: AppBar(title: const Text('Profile')),
        body: BlocBuilder<ProfileBloc, ProfileState>(
          builder: (context, state) {
            if (state is ProfileLoading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state is ProfileLoaded || state is ProfileUpdated) {
              final profile = state is ProfileLoaded
                  ? state.profile
                  : (state as ProfileUpdated).profile;
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const SizedBox(height: 16),
                  const CircleAvatar(
                    radius: 40,
                    backgroundColor: Color(0xFFD4AF37),
                    child: Icon(Icons.person, size: 40, color: Colors.black),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '${profile['firstName'] ?? ''} ${profile['lastName'] ?? ''}'.trim(),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text(
                    profile['phone'] ?? '',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  if (profile['balance'] != null)
                    Text(
                      'Balance: \$${profile['balance']['amount']}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFFD4AF37), fontSize: 18),
                    ),
                  const SizedBox(height: 32),
                  ListTile(
                    leading: const Icon(Icons.edit),
                    title: const Text('Edit Profile'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      _showEditDialog(context, profile);
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip),
                    title: const Text('Privacy Policy'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const _PrivacyPolicyPage()),
                      );
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.logout, color: Colors.red),
                    title: const Text('Logout', style: TextStyle(color: Colors.red)),
                    onTap: () {
                      context.read<AuthBloc>().add(AuthLogoutRequested());
                    },
                  ),
                ],
              );
            }
            if (state is ProfileError) {
              return Center(child: Text(state.message));
            }
            return const SizedBox();
          },
        ),
      ),
    );
  }

  void _showEditDialog(BuildContext context, Map<String, dynamic> profile) {
    final firstNameCtrl = TextEditingController(text: profile['firstName'] ?? '');
    final lastNameCtrl = TextEditingController(text: profile['lastName'] ?? '');

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Edit Profile'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: firstNameCtrl, decoration: const InputDecoration(labelText: 'First Name')),
            const SizedBox(height: 12),
            TextField(controller: lastNameCtrl, decoration: const InputDecoration(labelText: 'Last Name')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              context.read<ProfileBloc>().add(UpdateProfile(
                    firstName: firstNameCtrl.text,
                    lastName: lastNameCtrl.text,
                  ));
              Navigator.pop(dialogContext);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

class _PrivacyPolicyPage extends StatelessWidget {
  const _PrivacyPolicyPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy Policy')),
      body: FutureBuilder<String>(
        future: sl<ProfileDatasource>().getPrivacyPolicy(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Text(snapshot.data ?? 'No privacy policy available.'),
          );
        },
      ),
    );
  }
}
