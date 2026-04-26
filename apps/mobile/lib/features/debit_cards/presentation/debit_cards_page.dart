import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/di/injection.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../l10n/app_localizations.dart';

class DebitCardsPage extends StatefulWidget {
  const DebitCardsPage({super.key});
  @override
  State<DebitCardsPage> createState() => _DebitCardsPageState();
}

class _DebitCardsPageState extends State<DebitCardsPage> {
  final ApiClient _api = sl<ApiClient>();
  List<dynamic> _cards = [];
  List<dynamic> _mine = [];
  bool _loading = true;
  String? _buyingId;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _load();
    // Re-render every minute so countdowns update.
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await Future.wait([
        _api.dio.get(ApiConstants.debitCards),
        _api.dio.get(ApiConstants.myDebitCards),
      ]);
      _cards = res[0].data as List<dynamic>;
      _mine = res[1].data as List<dynamic>;
    } catch (_) {
      _cards = [];
      _mine = [];
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _buy(String cardId) async {
    setState(() => _buyingId = cardId);
    try {
      await _api.dio.post(ApiConstants.buyDebitCard(cardId));
      if (!mounted) return;
      final t = AppLocalizations.of(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.tr('cardBoughtSuccess')), backgroundColor: Colors.green),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      String msg = 'Failed';
      try {
        msg = (e as dynamic).response?.data?['message']?.toString() ?? 'Failed';
      } catch (_) {}
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _buyingId = null);
    }
  }

  String _cardLabel(Map<String, dynamic> c, String lang) {
    switch (lang) {
      case 'ar':
        return (c['nameAr'] ?? c['nameEn'] ?? '').toString();
      case 'ckb':
        return (c['nameCkb'] ?? c['nameEn'] ?? '').toString();
      default:
        return (c['nameEn'] ?? '').toString();
    }
  }

  String _remaining(String iso) {
    final end = DateTime.tryParse(iso);
    if (end == null) return '—';
    final ms = end.difference(DateTime.now()).inSeconds;
    if (ms <= 0) return 'expired';
    final h = ms ~/ 3600;
    final m = (ms % 3600) ~/ 60;
    if (h > 0) return '${h}h ${m}m';
    return '${m}m';
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(t.tr('debitCards'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFD4AF37)))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Active cards
                  Text(t.tr('activeCards'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  if (_mine.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(child: Text(t.tr('noActiveCards'), style: const TextStyle(color: Colors.grey))),
                    )
                  else
                    ..._mine.map((m) {
                      final card = m['debitCard'] as Map<String, dynamic>;
                      final bonus = double.tryParse(m['bonusAmount'].toString()) ?? 0;
                      final pct = double.tryParse(m['percentage'].toString()) ?? 0;
                      final remaining = _remaining(m['expiresAt'].toString());
                      final isLow = remaining != 'expired' &&
                          (DateTime.tryParse(m['expiresAt'].toString())?.difference(DateTime.now()).inMinutes ?? 99) < 60;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        color: const Color(0xFFD4AF37).withValues(alpha: 0.06),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: Color(0xFFD4AF37), width: 1),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Container(
                                width: 46, height: 46,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                                    colors: [Color(0xFFD4AF37), Color(0xFFc5a030)],
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.credit_card, color: Colors.black),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(_cardLabel(card, lang), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${pct.toStringAsFixed(0)}%  •  +\$${bonus.toStringAsFixed(2)}',
                                      style: const TextStyle(color: Color(0xFFD4AF37), fontWeight: FontWeight.w600, fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Icon(Icons.access_time, size: 14, color: isLow ? Colors.amber : Colors.green),
                                  const SizedBox(height: 2),
                                  Text(remaining, style: TextStyle(fontSize: 12, color: isLow ? Colors.amber : Colors.green, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }),

                  const SizedBox(height: 24),
                  Text(t.tr('debitCards'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  if (_cards.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(child: Text(t.tr('noCardsAvailable'), style: const TextStyle(color: Colors.grey))),
                    )
                  else
                    ..._cards.map((c) {
                      final pct = double.tryParse(c['percentage'].toString()) ?? 0;
                      final price = double.tryParse(c['price'].toString()) ?? 0;
                      final hours = c['durationHours'] as int? ?? 0;
                      final isBuying = _buyingId == c['id'];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 44, height: 44,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFD4AF37).withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.credit_card, color: Color(0xFFD4AF37)),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _cardLabel(c, lang),
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                          maxLines: 1, overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '+${pct.toStringAsFixed(0)}%  •  ${hours}h',
                                          style: const TextStyle(color: Color(0xFFD4AF37), fontWeight: FontWeight.w600, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text('\$${price.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFFD4AF37))),
                                ],
                              ),
                              const SizedBox(height: 10),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  onPressed: isBuying ? null : () => _buy(c['id'].toString()),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFD4AF37),
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(vertical: 10),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  child: isBuying
                                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                                      : Text(t.tr('buyCard'), style: const TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
