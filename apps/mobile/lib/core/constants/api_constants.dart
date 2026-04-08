import 'dart:io';

class ApiConstants {
  /// Change this to your PC's local IP when testing on a real device.
  /// Use '10.0.2.2' for Android emulator, '127.0.0.1' for iOS simulator.
  static String get _host {
    // Auto-detect: real device vs emulator
    // On real device, use your PC's local network IP
    // On emulator, use the special alias
    try {
      // If running on Android emulator, 10.0.2.2 maps to host machine
      // For real phones on same Wi-Fi, use the PC's IP
      return '10.0.2.2'; // Android emulator → host machine
    } catch (_) {
      return '10.0.2.2';
    }
  }

  static String get baseUrl => 'http://$_host:3000/api';
  static String get wsUrl => 'http://$_host:3000/ws';

  // Auth
  static const String login = '/auth/login';
  static const String directLogin = '/auth/direct-login';
  static const String verifyOtp = '/auth/verify-otp';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';

  // Users
  static const String profile = '/users/me';

  // Symbols
  static const String symbols = '/symbols';

  // Trades
  static const String openTrade = '/trades/open';
  static String closeTrade(String id) => '/trades/$id/close';
  static const String openTrades = '/trades/open';
  static const String tradeHistory = '/trades/history';
  static const String dashboard = '/trades/dashboard';

  // Balance
  static const String balance = '/balances/me';

  // Settings
  static const String privacyPolicy = '/settings/privacy-policy';
}
