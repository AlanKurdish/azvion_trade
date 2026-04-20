import 'package:flutter/foundation.dart';
import '../network/api_client.dart';
import '../constants/api_constants.dart';
import '../di/injection.dart';

/// Fetches + exposes global app configuration from the backend.
/// Currently just `demoMode`, but structured for future flags.
class AppConfig extends ChangeNotifier {
  bool _demoMode = false;
  bool _loaded = false;

  bool get demoMode => _demoMode;
  bool get isLoaded => _loaded;

  /// Fetch demo mode from the backend. Silently defaults to `false` on error
  /// so the app still functions even if backend is unreachable.
  Future<void> load() async {
    try {
      final response = await sl<ApiClient>().dio.get(ApiConstants.demoMode);
      final data = response.data;
      _demoMode = data is Map && data['demoMode'] == true;
    } catch (_) {
      _demoMode = false;
    } finally {
      _loaded = true;
      notifyListeners();
    }
  }

  /// Reload (useful if admin toggles the flag while the app is open).
  Future<void> refresh() async {
    await load();
  }
}

final appConfig = AppConfig();
