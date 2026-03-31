import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/api_constants.dart';

class WebSocketClient {
  io.Socket? _socket;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final _controllers = <String, StreamController<dynamic>>{};

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) return;

    _socket = io.io(
      ApiConstants.wsUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      print('WebSocket connected');
    });

    _socket!.onDisconnect((_) {
      print('WebSocket disconnected');
    });

    _socket!.on('authenticated', (data) {
      if (data['success'] != true) {
        disconnect();
      }
    });

    // Price updates
    _socket!.on('price:update', (data) {
      _emit('price:update', data);
    });

    // Trade P&L
    _socket!.on('trade:pnl', (data) {
      _emit('trade:pnl', data);
    });

    // Trade events
    _socket!.on('trade:opened', (data) {
      _emit('trade:opened', data);
    });

    _socket!.on('trade:closed', (data) {
      _emit('trade:closed', data);
    });

    _socket!.on('balance:updated', (data) {
      _emit('balance:updated', data);
    });

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    for (final controller in _controllers.values) {
      controller.close();
    }
    _controllers.clear();
  }

  Stream<dynamic> on(String event) {
    _controllers[event] ??= StreamController<dynamic>.broadcast();
    return _controllers[event]!.stream;
  }

  void subscribePrices(List<String> mtSymbols) {
    _socket?.emit('subscribe:prices', {'symbols': mtSymbols});
  }

  void unsubscribePrices(List<String> mtSymbols) {
    _socket?.emit('unsubscribe:prices', {'symbols': mtSymbols});
  }

  void subscribeTrade(String tradeId) {
    _socket?.emit('subscribe:trade', {'tradeId': tradeId});
  }

  void unsubscribeTrade(String tradeId) {
    _socket?.emit('unsubscribe:trade', {'tradeId': tradeId});
  }

  void _emit(String event, dynamic data) {
    _controllers[event]?.add(data);
  }
}
