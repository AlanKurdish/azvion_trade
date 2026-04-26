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
  double _balance = 0;
  bool _loading = true;
  String? _buyingId;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _load();
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
        _api.dio.get(ApiConstants.balance),
      ]);
      _cards = res[0].data as List<dynamic>;
      _mine = res[1].data as List<dynamic>;
      _balance = double.tryParse((res[2].data['amount'] ?? 0).toString()) ?? 0;
    } catch (_) {
      _cards = [];
      _mine = [];
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Show a confirmation modal before purchasing the card. Returns true if
  /// the user confirmed, false otherwise.
  Future<bool> _showConfirmModal(Map<String, dynamic> card) async {
    final t = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final pct = double.tryParse(card['percentage'].toString()) ?? 0;
    final price = double.tryParse(card['price'].toString()) ?? 0;
    final hours = card['durationHours'] as int? ?? 0;
    final bonus = (_balance * pct) / 100;
    final newBalance = _balance - price + bonus;
    final notEnough = _balance < price;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(ctx).cardTheme.color,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + MediaQuery.of(ctx).viewPadding.bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey[700], borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 18),

              // Card header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                    colors: [Color(0xFFD4AF37), Color(0xFFc5a030)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.credit_card, color: Colors.black, size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _cardLabel(card, lang),
                            style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                          Text(
                            '${pct.toStringAsFixed(0)}% boost  •  ${hours}h',
                            style: const TextStyle(color: Color(0xFF222222), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Detail rows
              _row(t.tr('balance'), '\$${_balance.toStringAsFixed(2)}'),
              _row(t.tr('cardPrice'), '-\$${price.toStringAsFixed(2)}', valueColor: Colors.red),
              _row(t.tr('cardBonus'), '+\$${bonus.toStringAsFixed(2)}', valueColor: Colors.green),
              const Divider(height: 24),
              _row(
                t.tr('newBalance'),
                '\$${newBalance.toStringAsFixed(2)}',
                valueColor: const Color(0xFFD4AF37),
                bold: true,
              ),
              const SizedBox(height: 6),
              Text(
                t.tr('cardActiveFor', args: {'hours': hours.toString()}),
                style: const TextStyle(color: Colors.grey, fontSize: 11),
              ),

              if (notEnough) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber, color: Colors.red, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          t.tr('insufficientBalance'),
                          style: const TextStyle(color: Colors.red, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: BorderSide(color: Colors.grey[600]!),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(t.tr('cancel')),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: notEnough ? null : () => Navigator.pop(ctx, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD4AF37),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        disabledBackgroundColor: Colors.grey[800],
                      ),
                      child: Text(
                        '${t.tr('confirm')} • \$${price.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
    return confirmed == true;
  }

  Widget _row(String label, String value, {Color? valueColor, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.w600,
              fontSize: bold ? 17 : 14,
              color: valueColor,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _onBuyTap(Map<String, dynamic> card) async {
    final confirmed = await _showConfirmModal(card);
    if (!confirmed) return;
    await _doBuy(card['id'].toString());
  }

  Future<void> _doBuy(String cardId) async {
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
                                  onPressed: isBuying ? null : () => _onBuyTap(c as Map<String, dynamic>),
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
