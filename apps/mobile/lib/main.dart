import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/di/injection.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/auth/presentation/pages/otp_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  initDependencies();
  runApp(const AzinForexApp());
}

class AzinForexApp extends StatelessWidget {
  const AzinForexApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<AuthBloc>()..add(AuthCheckStatus()),
      child: MaterialApp(
        title: 'Azin Forex',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: BlocConsumer<AuthBloc, AuthState>(
          listener: (context, state) {},
          builder: (context, state) {
            if (state is AuthInitial || state is AuthLoading) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }
            if (state is AuthOtpSent) {
              return OtpPage(phone: state.phone);
            }
            if (state is AuthAuthenticated) {
              return const MainShell();
            }
            return const LoginPage();
          },
        ),
      ),
    );
  }
}
