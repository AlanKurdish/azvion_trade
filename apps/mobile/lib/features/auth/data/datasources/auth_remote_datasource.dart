import '../../../../core/network/api_client.dart';
import '../../../../core/constants/api_constants.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthRemoteDatasource {
  final ApiClient _apiClient;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthRemoteDatasource(this._apiClient);

  Future<void> _persistAuth(Map<String, dynamic> data) async {
    await _storage.write(key: 'access_token', value: data['accessToken']);
    await _storage.write(key: 'refresh_token', value: data['refreshToken']);
    final role = data['user']?['role']?.toString();
    if (role != null) {
      await _storage.write(key: 'user_role', value: role);
    }
  }

  Future<Map<String, dynamic>> login(String phone, String password) async {
    final response = await _apiClient.dio.post(ApiConstants.login, data: {
      'phone': phone,
      'password': password,
    });
    final data = response.data;
    await _persistAuth(data);
    return data;
  }

  /// Returns the cached user role ('USER' / 'SHOP' / 'ADMIN'); defaults to 'USER'
  Future<String> getRole() async {
    return (await _storage.read(key: 'user_role')) ?? 'USER';
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
