import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';

class TradeDatasource {
  final ApiClient _apiClient;
  TradeDatasource(this._apiClient);

  Future<List<dynamic>> getSymbols() async {
    final response = await _apiClient.dio.get(ApiConstants.symbols);
    return response.data;
  }

  Future<List<dynamic>> getCategories() async {
    final response = await _apiClient.dio.get(ApiConstants.symbolCategories);
    return response.data;
  }

  Future<List<dynamic>> getOpenTrades() async {
    final response = await _apiClient.dio.get(ApiConstants.openTrades);
    return response.data;
  }

  Future<Map<String, dynamic>> openTrade(String symbolId) async {
    final response = await _apiClient.dio.post(ApiConstants.openTrade, data: {
      'symbolId': symbolId,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> closeTrade(String tradeId) async {
    final response = await _apiClient.dio.post(ApiConstants.closeTrade(tradeId));
    return response.data;
  }
}
