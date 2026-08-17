/**
 * 設定項目
 * ここに秘密の値(URL・メールアドレス等)を直接書かないこと。
 * 「スクリプトのプロパティ」(Apps Scriptエディタ → 歯車アイコン →
 * 「プロジェクトの設定」→「スクリプト プロパティ」)に登録して読み込む。
 *
 * 必要なプロパティ一覧:
 *   ADMIN_EMAIL       管理者(通知・BCC先)のメールアドレス
 *   SLACK_WEBHOOK_URL  Slack通知用のIncoming Webhook URL
 *   SLACK_MEMBER_ID    Slackでメンションする担当者のメンバーID
 *   SPREADSHEET_ID     注文台帳スプレッドシートのID(通常版と同じ台帳)
 *   PRINTER_EMAIL      フリーメイト発注先(印刷業者)のメールアドレス
 *   SQUARE_ACCESS_TOKEN  Square APIのアクセストークン
 *   SQUARE_LOCATION_ID   SquareのLocation ID
 *   SQUARE_API_BASE      'https://connect.squareupsandbox.com'(テスト) または
 *                         'https://connect.squareup.com'(本番)
 *   NOTION_API_KEY       Notion連携用インテグレーションのシークレット
 *
 * GAS_通常版_APIとの違い: 送料無料・納期3営業日固定(特急オプションなし)。
 * 画面(HTML)はNetlify等で配信し、このプロジェクトはdoPostで
 * 注文データを受け取る役割のみを持つ。注文後、Square決済リンクを発行する。
 */
const SCRIPT_PROPS = PropertiesService.getScriptProperties();
const ADMIN_EMAIL = SCRIPT_PROPS.getProperty('ADMIN_EMAIL');
const NOTIFICATION_URL = SCRIPT_PROPS.getProperty('SLACK_WEBHOOK_URL');
const SLACK_MEMBER_ID = SCRIPT_PROPS.getProperty('SLACK_MEMBER_ID');
const SPREADSHEET_ID = SCRIPT_PROPS.getProperty('SPREADSHEET_ID');
const PRINTER_EMAIL = SCRIPT_PROPS.getProperty('PRINTER_EMAIL');
const SQUARE_ACCESS_TOKEN = SCRIPT_PROPS.getProperty('SQUARE_ACCESS_TOKEN');
const SQUARE_LOCATION_ID = SCRIPT_PROPS.getProperty('SQUARE_LOCATION_ID');
const SQUARE_API_BASE = SCRIPT_PROPS.getProperty('SQUARE_API_BASE') || 'https://connect.squareupsandbox.com';
const SS_URL = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit';

// ===== Notion連携(注文後にDB_プロジェクト・DB_現金出納帳_F3へ自動記録) =====
const NOTION_VERSION = '2025-09-03';
const NOTION_DB_PROJECT_DATASOURCE_ID = '04875878-4070-47bb-85ab-fed881e7d7e4';
const NOTION_DB_CASHBOOK_DATASOURCE_ID = 'd5ba36f0-59e9-4377-b1ad-0cc43144afc5';
const NOTION_STAFF_SUGIKADO_ID = '196d872b-594c-8122-97f7-000281a411a0';

function _notionApiRequest(path, payload) {
  var token = SCRIPT_PROPS.getProperty('NOTION_API_KEY');
  if (!token) {
    console.error('スクリプトプロパティ「NOTION_API_KEY」が未設定のため、Notionへの記録をスキップしました');
    return null;
  }
  var res = UrlFetchApp.fetch('https://api.notion.com/v1/' + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': NOTION_VERSION },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText());
  if (res.getResponseCode() >= 300) {
    console.error('Notion APIエラー(' + path + '): ' + res.getContentText());
    return null;
  }
  return body;
}

// 注文をNotionのDB_プロジェクト(案件ページ)とDB_現金出納帳_F3(商品ごとの明細行)に記録する。
// 失敗しても注文自体(メール送信・決済)には影響させない。呼び出し側でtry/catchすること。
function recordOrderToNotion_(formData, lineItems, orderDate) {
  var dateStr = Utilities.formatDate(orderDate, 'Asia/Tokyo', 'yyMMdd');
  var isoDate = Utilities.formatDate(orderDate, 'Asia/Tokyo', 'yyyy-MM-dd');
  var projectTitle = dateStr + '_' + formData.userName + '_印鑑注文';

  var projectPage = _notionApiRequest('pages', {
    parent: { type: 'data_source_id', data_source_id: NOTION_DB_PROJECT_DATASOURCE_ID },
    template: { type: 'default' },
    properties: {
      '案件名': { title: [{ text: { content: projectTitle } }] },
      '開始日': { date: { start: isoDate } },
      '担当者': { people: [{ id: NOTION_STAFF_SUGIKADO_ID }] },
      '進捗状況': { status: { name: '完了(クレジット)' } }
    }
  });
  if (!projectPage || !projectPage.id) return;

  lineItems.forEach(function(item) {
    var qty = parseInt(item.quantity, 10) || 1;
    var unitPriceExcl = Math.round(item.base_price_money.amount / 1.1);
    _notionApiRequest('pages', {
      parent: { type: 'data_source_id', data_source_id: NOTION_DB_CASHBOOK_DATASOURCE_ID },
      properties: {
        '品目': { title: [{ text: { content: item.name } }] },
        '日付': { date: { start: isoDate } },
        '数量': { number: qty },
        '項目': { select: { name: '売上' } },
        '種別': { select: { name: '印鑑' } },
        '単価(税抜)': { number: unitPriceExcl },
        '課税対象': { select: { name: 'はい(10%)' } },
        'DB_プロジェクト': { relation: [{ id: projectPage.id }] }
      }
    });
  });
}

// 価格設定（税込）
const PRICE_CORP_TSUGE_NORMAL = 8800;
const PRICE_CORP_TSUGE_SPECIAL = 7700;
const PRICE_CORP_KURO  = 22000;
const PRICE_CORP_TITAN = 102850;
const FREIMATE_UNIT_PRICE = 1320;
const SHIPPING_FEE = 0; // 送料無料
const OPTION_DIGITAL_FEE = 2200;

// 単品注文（1本から購入可）の価格表（税込）
const SINGLE_ITEMS_CONFIG = [
  { checkboxField: 'hasSingle15', materialField: 'single15Material', qtyField: 'single15Qty', textField: 'single15Text', label: '15ミリ丸棒',        prices: { '薩摩本柘': 3630,  '黒水牛': 4070,  'チタン': 27500 } },
  { checkboxField: 'hasSingle18', materialField: 'single18Material', qtyField: 'single18Qty', textField: 'single18Text', label: '18ミリ天丸鞘付き', prices: { '薩摩本柘': 6270,  '黒水牛': 11330, 'チタン': 33000 } },
  { checkboxField: 'hasSingle21', materialField: 'single21Material', qtyField: 'single21Qty', textField: 'single21Text', label: '21ミリ角天',        prices: { '薩摩本柘': 5000,  '黒水牛': 13000, 'チタン': 49500 } },
];
const PRICE_INK_BUNKA30 = 950; // 文化朱肉30号

function toHalfWidth(str) {
  if (!str) return "";
  return String(str).replace(/[０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

// フォームで選ばれた単品注文（15/18/21ミリ）を集計する
function _buildSingleOrderItems(formData) {
  var lines = [];
  var items = [];
  var subtotal = 0;
  SINGLE_ITEMS_CONFIG.forEach(function(cfg) {
    var checked = (formData[cfg.checkboxField] === 'true' || formData[cfg.checkboxField] === 'on');
    if (!checked) return;
    var material = formData[cfg.materialField] || '薩摩本柘';
    var qty = parseInt(formData[cfg.qtyField]) || 1;
    var unitPrice = cfg.prices[material];
    var text = toHalfWidth((formData[cfg.textField] || "").trim());
    subtotal += unitPrice * qty;
    lines.push(cfg.label + "（" + material + "）× " + qty + "本" + (text ? "　印字内容：" + text : ""));
    items.push({ name: cfg.label + "（" + material + "）", qty: qty, unitPrice: unitPrice });
  });
  return { text: lines.join(" / "), subtotal: subtotal, lines: lines, items: items };
}

// Square注文明細(line_items)の1行を組み立てる。quantityは文字列で渡す仕様。
function _sqLineItem(name, quantity, unitPrice) {
  return { name: name, quantity: String(quantity), base_price_money: { amount: unitPrice, currency: 'JPY' } };
}

// 外部(Netlify等)でホストするフォームからのfetch(POST)を受け取る入口。
// プリフライト(OPTIONS)を発生させないよう、フォーム側はContent-Type: text/plainで送る想定。
function doPost(e) {
  var formData = JSON.parse(e.postData.contents);
  var result = processOrderForm(formData);
  var success = result.message.indexOf('エラー発生') !== 0;
  return ContentService.createTextOutput(JSON.stringify({ success: success, message: result.message, paymentUrl: result.paymentUrl }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Squareの決済リンク(Payment Links API)を、商品明細つきの注文(order)として作成する。
// 手数料は自社負担のため、各明細の金額はそのまま課金する(上乗せしない)。
// JPYは補助単位を持たないため、amountはそのまま円の整数値でよい。
function createSquarePaymentLink(lineItems, customerName) {
  if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
    console.error('Square未設定: SQUARE_ACCESS_TOKENまたはSQUARE_LOCATION_IDが未設定です');
    return null;
  }
  var payload = {
    idempotency_key: Utilities.getUuid(),
    order: {
      location_id: SQUARE_LOCATION_ID,
      reference_id: customerName,
      line_items: lineItems
    }
  };
  var res = UrlFetchApp.fetch(SQUARE_API_BASE + '/v2/online-checkout/payment-links', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + SQUARE_ACCESS_TOKEN, 'Square-Version': '2025-01-23' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText());
  if (body.payment_link && body.payment_link.url) {
    return body.payment_link.url;
  }
  console.error('Square決済リンク作成失敗: ' + res.getContentText());
  return null;
}

function processOrderForm(formData) {
  // 安全のためログに全データを記録
  console.log("送信データ: " + JSON.stringify(formData));

  try {

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('注文台帳_総合');

  formData.tel = toHalfWidth(formData.tel);
  formData.zipCode = toHalfWidth(formData.zipCode);
  formData.address_manual = toHalfWidth(formData.address_manual);

  var total = 0;
  var lineItems = [];
  var isSpecial = (formData.isSpecial === 'true');
  var hasCorp = (formData.hasCorporate === 'true' || formData.hasCorporate === 'on');
  var hasFrei = (formData.hasFreimate === 'true' || formData.hasFreimate === 'on');
  var isDigital = (hasCorp && (formData.isDigital === 'true' || formData.isDigital === 'on'));
  var deliveryType = "3営業日以内に発送";

  var corpMaterial = "-";
  var innerTitle = "-";
  var corpFont = "-";

  if (hasCorp) {
    corpMaterial = formData.corpMaterial;
    corpFont = formData.corpFont || "未選択"; // フォームから書体を取得
    innerTitle = (formData.corpText1_inner === "その他") ? formData.corpText1_inner_other : formData.corpText1_inner;
    var tsugePrice = isSpecial ? PRICE_CORP_TSUGE_SPECIAL : PRICE_CORP_TSUGE_NORMAL;
    var corpPrice = (corpMaterial === '黒水牛') ? PRICE_CORP_KURO : (corpMaterial === 'チタン') ? PRICE_CORP_TITAN : tsugePrice;
    total += corpPrice;
    lineItems.push(_sqLineItem('法人3本セット（' + corpMaterial + '）', 1, corpPrice));
    if (isDigital) { total += OPTION_DIGITAL_FEE; lineItems.push(_sqLineItem('角印電子データ化オプション', 1, OPTION_DIGITAL_FEE)); }
  }

  var freiQty = 0;
  var freiTexts = [];
  if (hasFrei) {
    freiQty = parseInt(formData.freiQuantity);
    total += freiQty * FREIMATE_UNIT_PRICE;
    lineItems.push(_sqLineItem('フリーメイト（組み合わせゴム印）', freiQty, FREIMATE_UNIT_PRICE));
    for (var i = 0; i < freiQty; i++) { freiTexts.push(toHalfWidth(formData['frei_stamp_' + i])); }
  }

  var singleResult = _buildSingleOrderItems(formData);
  total += singleResult.subtotal;
  singleResult.items.forEach(function(it) { lineItems.push(_sqLineItem(it.name, it.qty, it.unitPrice)); });

  var hasInk = (formData.hasInk === 'true' || formData.hasInk === 'on');
  var inkQty = hasInk ? (parseInt(formData.inkQty) || 1) : 0;
  total += inkQty * PRICE_INK_BUNKA30;
  if (inkQty > 0) lineItems.push(_sqLineItem('文化朱肉30号', inkQty, PRICE_INK_BUNKA30));

  total += SHIPPING_FEE; // 送料無料のため加算なし

  var fullAddress = formData.address_auto + formData.address_manual;

  var detailString = "材質:" + corpMaterial + " / 書体:" + corpFont + " / 社名:" + formData.corpName + " / 役職:" + innerTitle;

  sheet.appendRow([
    new Date(), formData.referrer, corpMaterial, detailString,
    hasFrei ? freiQty : "-", freiTexts.join(" / "),
    singleResult.lines.length > 0 ? singleResult.text : "-",
    inkQty > 0 ? inkQty : "-",
    "-", isDigital ? "○" : "-", total,
    formData.userName, formData.email, formData.zipCode, fullAddress, formData.tel, formData.remarks
  ]);

  var paymentUrl = createSquarePaymentLink(lineItems, formData.userName);

  try {
    recordOrderToNotion_(formData, lineItems, new Date());
  } catch (notionErr) {
    console.error('Notion記録でエラー: ' + notionErr.toString());
  }

  sendOrderEmails(formData, total, hasCorp, corpMaterial, innerTitle, hasFrei, freiTexts, singleResult, inkQty, isDigital, deliveryType, fullAddress, corpFont, paymentUrl);
  return { message: "ご注文を承りました。内容確認のメールをお送りしました。", paymentUrl: paymentUrl };

  } catch (e) {
    console.error(e.toString());
    return { message: "エラー発生: " + e.toString(), paymentUrl: null };
  }
}

function sendOrderEmails(data, total, hasCorp, corpMaterial, innerTitle, hasFrei, freiTexts, singleResult, inkQty, isDigital, deliveryType, fullAddress, corpFont, paymentUrl) {
  var subject = "【注文受付】" + data.userName + "様（合計：" + total.toLocaleString() + "円）";
  var body = data.userName + " 様\n\nご注文ありがとうございます。\n\n【合計金額】" + total.toLocaleString() + "円(税込・送料無料)\n【納期】" + deliveryType + "\n\n";
  body += paymentUrl
    ? "【お支払い】\n下記のリンクからクレジットカードでお支払いください。\n" + paymentUrl + "\n\n"
    : "【お支払い】\n決済リンクの発行に失敗しました。お手数ですが担当者からのご連絡をお待ちください。\n\n";

  var orderDetails = "";
  if (hasCorp) {
    orderDetails += "■法人3本セット\n" +
                    "役職：" + innerTitle + "\n" +
                    "社名：" + data.corpName + "\n" +
                    "材質：" + corpMaterial + "\n" +
                    "書体：" + corpFont + "\n";
    if (isDigital) orderDetails += "・角印電子データ化：希望する\n";
    orderDetails += "\n";
  }
  if (hasFrei) {
    orderDetails += "■フリーメイト内容（" + freiTexts.length + "枚）\n";
    freiTexts.forEach(function(t, i) { orderDetails += (i+1) + "枚目：" + t + "\n"; });
    orderDetails += "\n";
  }
  if (singleResult.lines.length > 0) {
    orderDetails += "■単品注文\n";
    singleResult.lines.forEach(function(l) { orderDetails += "・" + l + "\n"; });
    orderDetails += "\n";
  }
  if (inkQty > 0) {
    orderDetails += "■文化朱肉30号 × " + inkQty + "\n\n";
  }
  body += orderDetails + "【送り先】\n〒" + data.zipCode + "\n" + fullAddress + "\n" + data.userName + " 様\n電話番号：" + data.tel + "\n";
  if (data.remarks) body += "\n【備考】\n" + data.remarks + "\n";
  GmailApp.sendEmail(data.email, subject, body, { from: ADMIN_EMAIL, bcc: ADMIN_EMAIL });

  // Slack通知（担当者への個人メンション付き）
  var mention = "<@" + SLACK_MEMBER_ID + ">";
  var slackText = mention + " *【印鑑注文（送料無料版）が入りました】*\n\n" +
                  "*■基本情報*\n" +
                  "・注文者: " + data.userName + " 様\n" +
                  "・合計金額: " + total.toLocaleString() + "円 (税込)\n" +
                  "・納期: " + deliveryType + "\n\n" +
                  "*■発注内容*\n" + orderDetails +
                  "*■送り先情報*\n" +
                  "〒" + data.zipCode + "\n" +
                  fullAddress + "\n" +
                  data.userName + " 様\n" +
                  "TEL: " + data.tel + "\n";

  if (data.remarks) slackText += "\n*■備考*\n" + data.remarks + "\n";
  slackText += "\n詳細: <" + SS_URL + "|スプレッドシートを確認>";

  UrlFetchApp.fetch(NOTIFICATION_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ text: slackText })
  });

  createPrinterDraftOnlyFreimate(data, hasFrei, freiTexts, deliveryType);
}

function createPrinterDraftOnlyFreimate(data, hasFrei, freiTexts, deliveryType) {
  if (!hasFrei) return;
  var qty = freiTexts.length;
  var body = "西脇さま\n\nお世話になっております\nF3株式会社の杉角です\n\nフリーメイトの注文です\n\n62㎜でお願いします\n\n";
  freiTexts.forEach(function(t, i) { body += (i + 1) + "行目：" + t + "\n\n"; });
  body += "以上、" + qty + "枚です\n\n【納期】" + deliveryType + "\n\nお手数をおかけしますが\n校正の確認行いたいと思います\n\nよろしくお願いいたします";
  GmailApp.createDraft(PRINTER_EMAIL, "発注依頼(" + data.userName + "様分)", body);
}
