class ApiConstants {
  static const String baseUrl = 'http://10.0.2.2:3000/api'; // Android emulator
  static const String wsUrl = 'http://10.0.2.2:3000/ws';

  // Auth
  static const String login = '/auth/login';
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
