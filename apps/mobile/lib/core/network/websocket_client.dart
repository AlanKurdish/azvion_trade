import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/api_constants.dart';

class WebSocketClient {
  io.Socket? _socket;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final _controllers = <String, StreamController<dynamic>>{};

  // Tracks currently wanted price subscriptions so they can be re-sent
  // on every connect / reconnect automatically.
  List<String> _activeSubscriptions = [];

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    // Dispose previous socket if exists (but keep controllers alive)
    if (_socket != null) {
      _socket!.clearListeners();
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }

    final token = await _storage.read(key: 'access_token');

    final builder = io.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .enableReconnection()
        .setReconnectionAttempts(50)
        .setReconnectionDelay(2000)
        .enableForceNew()
        .disableAutoConnect();

    if (token != null) {
      builder.setAuth({'token': token});
    }

    print('[WS] Connecting to ${ApiConstants.wsUrl} (token: ${token != null ? 'yes' : 'no'})');

    _socket = io.io(ApiConstants.wsUrl, builder.build());

    _socket!.onConnect((_) {
      print('[WS] Connected to ${ApiConstants.wsUrl}');
      // Re-subscribe to any previously requested price symbols.
      // This handles both the initial case (HTTP symbols arrived before WS
      // connected) and reconnect scenarios.
      if (_activeSubscriptions.isNotEmpty) {
        print('[WS] Re-subscribing to prices: $_activeSubscriptions');
        _socket?.emit('subscribe:prices', {'symbols': _activeSubscriptions});
      }
    });

    _socket!.onDisconnect((reason) {
      print('[WS] Disconnected: $reason');
    });

    _socket!.onConnectError((error) {
      print('[WS] Connection error: $error');
    });

    _socket!.onError((error) {
      print('[WS] Error: $error');
    });

    _socket!.on('authenticated', (data) {
      if (data is Map && data['success'] == true) {
        print('[WS] Authenticated (guest: ${data['guest'] ?? false})');
      } else {
        print('[WS] Auth failed, disconnecting');
        _socket?.disconnect();
      }
    });

    // Price updates (room-based, after subscribe:prices)
    _socket!.on('price:update', (data) {
      _emit('price:update', data);
    });

    // Price broadcast (all clients, no subscription needed)
    _socket!.on('price:update:all', (data) {
      if (data is List) {
        for (final p in data) {
          _emit('price:update', p);
        }
      } else if (data is Map) {
        _emit('price:update', data);
      }
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

    // Online users count
    _socket!.on('online:count', (data) {
      _emit('online:count', data);
    });

    _socket!.connect();
  }

  void disconnect() {
    _socket?.clearListeners();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  Stream<dynamic> on(String event) {
    _controllers[event] ??= StreamController<dynamic>.broadcast();
    return _controllers[event]!.stream;
  }

  void subscribePrices(List<String> mtSymbols) {
    _activeSubscriptions = mtSymbols;
    print('[WS] Subscribing to prices: $mtSymbols (connected: ${_socket?.connected ?? false})');
    if (_socket?.connected == true) {
      _socket!.emit('subscribe:prices', {'symbols': mtSymbols});
    }
    // If not yet connected the onConnect handler above will send this once the
    // socket finishes its handshake, so nothing is lost.
  }

  void unsubscribePrices(List<String> mtSymbols) {
    _activeSubscriptions = [];
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
