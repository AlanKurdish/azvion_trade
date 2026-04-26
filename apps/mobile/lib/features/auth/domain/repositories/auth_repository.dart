abstract class AuthRepository {
  Future<Map<String, dynamic>> login(String phone, String password);
  Future<void> logout();
  Future<bool> isLoggedIn();
}
