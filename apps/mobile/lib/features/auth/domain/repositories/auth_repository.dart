abstract class AuthRepository {
  Future<Map<String, dynamic>> login(String phone, String password);
  Future<Map<String, dynamic>> verifyOtp(String phone, String code);
  Future<void> logout();
  Future<bool> isLoggedIn();
}
