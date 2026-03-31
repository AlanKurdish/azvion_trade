import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';

class PositionsDatasource {
  final ApiClient _apiClient;
  PositionsDatasource(this._apiClient);

  Future<List<dynamic>> getOpenPositions() async {
    final response = await _apiClient.dio.get(ApiConstants.openTrades);
    return response.data;
  }

  Future<Map<String, dynamic>> getHistory({int page = 1, int limit = 20}) async {
    final response = await _apiClient.dio.get(
      ApiConstants.tradeHistory,
      queryParameters: {'page': page, 'limit': limit},
    );
    return response.data;
  }
}
