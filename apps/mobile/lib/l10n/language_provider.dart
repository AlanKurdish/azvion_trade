import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class LanguageProvider extends ChangeNotifier {
  Locale _locale = const Locale('en');
  bool _isLoaded = false;
  bool _hasChosenLanguage = false;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Locale get locale => _locale;
  bool get isLoaded => _isLoaded;
  bool get hasChosenLanguage => _hasChosenLanguage;

  LanguageProvider() {
    _loadSavedLanguage();
  }

  Future<void> _loadSavedLanguage() async {
    final lang = await _storage.read(key: 'app_language');
    if (lang != null) {
      _locale = Locale(lang);
      _hasChosenLanguage = true;
    }
    _isLoaded = true;
    notifyListeners();
  }

  Future<void> setLocale(Locale locale) async {
    _locale = locale;
    _hasChosenLanguage = true;
    await _storage.write(key: 'app_language', value: locale.languageCode);
    notifyListeners();
  }
}
