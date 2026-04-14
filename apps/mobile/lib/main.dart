import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
// flutter_localizations imported via app_localizations.dart
import 'core/di/injection.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/trade/presentation/pages/symbols_page.dart';
import 'features/onboarding/language_selection_page.dart';
import 'features/onboarding/splash_screen.dart';
import 'core/network/websocket_client.dart';
import 'l10n/app_localizations.dart';
import 'l10n/language_provider.dart';

final languageProvider = LanguageProvider();
final themeNotifier = ValueNotifier<ThemeMode>(ThemeMode.system);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  initDependencies();
  runApp(const AzinApp());
}

class AzinApp extends StatefulWidget {
  const AzinApp({super.key});

  @override
  State<AzinApp> createState() => _AzinAppState();
}

class _AzinAppState extends State<AzinApp> {
  bool _splashDone = false;

  @override
  void initState() {
    super.initState();
    languageProvider.addListener(() => setState(() {}));
    themeNotifier.addListener(() => setState(() {}));
  }

  @override
  Widget build(BuildContext context) {
    // Wait for language provider to load from storage
    if (!languageProvider.isLoaded) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const Scaffold(
          body: Center(child: CircularProgressIndicator(color: Color(0xFFD4AF37))),
        ),
      );
    }

    // Show splash screen on every app launch
    if (!_splashDone) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: SplashScreen(onComplete: () => setState(() => _splashDone = true)),
      );
    }

    // Show language selection on first launch
    if (!languageProvider.hasChosenLanguage) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        home: const LanguageSelectionPage(),
      );
    }

    final locale = languageProvider.locale;
    final isRtl = AppLocalizations.rtlLanguages.contains(locale.languageCode);

    return BlocProvider(
      create: (_) => sl<AuthBloc>()..add(AuthCheckStatus()),
      child: MaterialApp(
        title: 'Azin',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightThemeFor(locale.languageCode),
        darkTheme: AppTheme.darkThemeFor(locale.languageCode),
        themeMode: themeNotifier.value,
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.allDelegates,
        builder: (context, child) {
          return Directionality(
            textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
            child: child!,
          );
        },
        home: BlocConsumer<AuthBloc, AuthState>(
          listener: (context, state) {},
          buildWhen: (previous, current) {
            // Don't rebuild shells on AuthError or AuthLoading — only on actual auth transitions
            if (current is AuthError || current is AuthLoading) return false;
            return true;
          },
          builder: (context, state) {
            if (state is AuthInitial) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }
            if (state is AuthAuthenticated) {
              return MainShell(key: mainShellKey);
            }
            return const _GuestShell();
          },
        ),
      ),
    );
  }
}

/// Guest shell — shows symbols (public) and login page
class _GuestShell extends StatefulWidget {
  const _GuestShell();

  @override
  State<_GuestShell> createState() => _GuestShellState();
}

class _GuestShellState extends State<_GuestShell> {
  int _index = 1; // Start on login tab

  @override
  void initState() {
    super.initState();
    // Connect WebSocket for live prices (guest mode, no token)
    sl<WebSocketClient>().connect();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final pages = [
      const SymbolsPage(),
      const LoginPage(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: [
          BottomNavigationBarItem(icon: const Icon(Icons.candlestick_chart), label: t.tr('navTrade')),
          BottomNavigationBarItem(icon: const Icon(Icons.login), label: t.tr('login')),
        ],
      ),
    );
  }
}
