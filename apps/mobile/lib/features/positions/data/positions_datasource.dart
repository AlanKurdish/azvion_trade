import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';

class PositionsDatasource {
  final ApiClient _apiClient;
  PositionsDatasource(this._apiClient);

  Future<List<dynamic>> getOpenPositions() async {
    final response = await _apiClient.dio.get(ApiConstants.openTrades);
    if (response.data is List) return response.data;
    return [];
  }

  Future<Map<String, dynamic>> getHistory({int page = 1, int limit = 20}) async {
    final response = await _apiClient.dio.get(
      ApiConstants.tradeHistory,
      queryParameters: {'page': page, 'limit': limit},
    );
    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    return {'trades': [], 'total': 0, 'page': page};
  }

  Future<Map<String, dynamic>> closeTrade(String tradeId) async {
    final response = await _apiClient.dio.post(ApiConstants.closeTrade(tradeId));
    return response.data;
  }
}
