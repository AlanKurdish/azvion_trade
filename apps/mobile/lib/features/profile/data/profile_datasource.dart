import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';

class ProfileDatasource {
  final ApiClient _apiClient;
  ProfileDatasource(this._apiClient);

  Future<Map<String, dynamic>> getProfile() async {
    final response = await _apiClient.dio.get(ApiConstants.profile);
    return response.data;
  }

  Future<Map<String, dynamic>> updateProfile({String? firstName, String? lastName, String? language}) async {
    final data = <String, dynamic>{};
    if (firstName != null) data['firstName'] = firstName;
    if (lastName != null) data['lastName'] = lastName;
    if (language != null) data['language'] = language;
    final response = await _apiClient.dio.patch(ApiConstants.profile, data: data);
    return response.data;
  }

  Future<String> getPrivacyPolicy() async {
    final response = await _apiClient.dio.get(ApiConstants.privacyPolicy);
    return response.data['value'] ?? '';
  }
}
