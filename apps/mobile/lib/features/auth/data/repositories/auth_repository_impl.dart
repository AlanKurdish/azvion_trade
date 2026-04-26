import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDatasource _datasource;

  AuthRepositoryImpl(this._datasource);

  @override
  Future<Map<String, dynamic>> login(String phone, String password) =>
      _datasource.login(phone, password);

  @override
  Future<void> logout() => _datasource.logout();

  @override
  Future<bool> isLoggedIn() => _datasource.isLoggedIn();
}
