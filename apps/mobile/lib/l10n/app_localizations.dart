import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'app_en.dart';
import 'app_ar.dart';
import 'app_ckb.dart';

class AppLocalizations {
  final Locale locale;
  AppLocalizations(this.locale);

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  static const List<Locale> supportedLocales = [
    Locale('en'),
    Locale('ar'),
    Locale('ckb'),
  ];

  static const List<String> rtlLanguages = ['ar', 'ckb'];

  bool get isRtl => rtlLanguages.contains(locale.languageCode);

  late final Map<String, String> _strings = _loadStrings();

  Map<String, String> _loadStrings() {
    switch (locale.languageCode) {
      case 'ar':
        return ar;
      case 'ckb':
        return ckb;
      default:
        return en;
    }
  }

  String tr(String key, {Map<String, String>? args}) {
    String value = _strings[key] ?? en[key] ?? key;
    if (args != null) {
      args.forEach((k, v) {
        value = value.replaceAll('{$k}', v);
      });
    }
    return value;
  }

  /// Returns all localization delegates including fallback for unsupported locales (ckb)
  static List<LocalizationsDelegate> get allDelegates => [
    delegate,
    _FallbackMaterialLocalizationsDelegate(),
    _FallbackCupertinoLocalizationsDelegate(),
    GlobalWidgetsLocalizations.delegate,
  ];
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => ['en', 'ar', 'ckb'].contains(locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) async => AppLocalizations(locale);

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppLocalizations> old) => false;
}

/// Fallback Material localizations — maps unsupported locales (ckb) to Arabic
class _FallbackMaterialLocalizationsDelegate extends LocalizationsDelegate<MaterialLocalizations> {
  @override
  bool isSupported(Locale locale) => true;

  @override
  Future<MaterialLocalizations> load(Locale locale) async {
    // For supported locales, use the standard delegate
    final supported = ['en', 'ar', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'tr', 'it', 'nl', 'pl', 'uk', 'hi', 'fa', 'he', 'th', 'vi', 'id', 'ms', 'bn', 'ur'];
    if (supported.contains(locale.languageCode)) {
      return GlobalMaterialLocalizations.delegate.load(locale);
    }
    // For ckb (Kurdish Sorani), fall back to Arabic
    if (locale.languageCode == 'ckb') {
      return GlobalMaterialLocalizations.delegate.load(const Locale('ar'));
    }
    // Default fallback to English
    return GlobalMaterialLocalizations.delegate.load(const Locale('en'));
  }

  @override
  bool shouldReload(covariant LocalizationsDelegate<MaterialLocalizations> old) => false;
}

/// Fallback Cupertino localizations
class _FallbackCupertinoLocalizationsDelegate extends LocalizationsDelegate<CupertinoLocalizations> {
  @override
  bool isSupported(Locale locale) => true;

  @override
  Future<CupertinoLocalizations> load(Locale locale) async {
    final supported = ['en', 'ar', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'tr', 'it', 'nl'];
    if (supported.contains(locale.languageCode)) {
      return GlobalCupertinoLocalizations.delegate.load(locale);
    }
    if (locale.languageCode == 'ckb') {
      return GlobalCupertinoLocalizations.delegate.load(const Locale('ar'));
    }
    return GlobalCupertinoLocalizations.delegate.load(const Locale('en'));
  }

  @override
  bool shouldReload(covariant LocalizationsDelegate<CupertinoLocalizations> old) => false;
}
