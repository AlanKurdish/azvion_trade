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
  static const String demoMode = '/settings/demo-mode';

  // Slideshow
  static const String slideshow = '/slideshow';

  // Debit cards
  static const String debitCards = '/debit-cards';
  static const String myDebitCards = '/debit-cards/mine';
  static String buyDebitCard(String id) => '/debit-cards/$id/buy';

  // Subscription
  static const String subscriptionStatus = '/subscription/status';
  static const String subscriptionBuy = '/subscription/buy';

  // Blog
  static const String blog = '/blog';
}
