class ApiConstants {
  static const String _baseHost = 'http://azne-app.com';

  static String get host => _baseHost;
  static String get baseUrl => '$_baseHost/api';
  static String get wsUrl => '$_baseHost/ws';

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

  // Symbol Categories
  static const String symbolCategories = '/symbol-categories';

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

  // Slideshow
  static const String slideshow = '/slideshow';
}
