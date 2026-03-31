import '../../../../core/network/api_client.dart';
import '../../../../core/constants/api_constants.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthRemoteDatasource {
  final ApiClient _apiClient;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthRemoteDatasource(this._apiClient);

  Future<Map<String, dynamic>> login(String phone, String password) async {
    final response = await _apiClient.dio.post(ApiConstants.login, data: {
      'phone': phone,
      'password': password,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> verifyOtp(String phone, String code) async {
    final response = await _apiClient.dio.post(ApiConstants.verifyOtp, data: {
      'phone': phone,
      'code': code,
    });
    final data = response.data;
    await _storage.write(key: 'access_token', value: data['accessToken']);
    await _storage.write(key: 'refresh_token', value: data['refreshToken']);
    return data;
  }

  Future<void> logout() async {
    try {
      await _apiClient.dio.post(ApiConstants.logout);
    } catch (_) {}
    await _storage.deleteAll();
  }

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }
}
