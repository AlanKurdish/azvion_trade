import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';

class DashboardDatasource {
  final ApiClient _apiClient;
  DashboardDatasource(this._apiClient);

  Future<Map<String, dynamic>> getDashboard() async {
    final response = await _apiClient.dio.get(ApiConstants.dashboard);
    return response.data;
  }
}
