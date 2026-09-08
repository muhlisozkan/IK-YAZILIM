-- Kişiye özel toplu SMS (DynamicSms) gövde şablonu
alter table sms_settings add column if not exists bulk_body_template text not null default '';

-- Teknomart DynamicSms: {numbers} = [{"nr","msg","xid"}, ...] dizisiyle değiştirilir
update sms_settings
set bulk_body_template = '{"type":1,"sendingType":2,"numbers":{numbers},"sender":"{sender}","title":"IK Merkezi {ts}","encoding":1,"commercial":false,"skipAhsQuery":true,"recipientType":0}'
where id = 1 and provider_name = 'Teknomart' and coalesce(btrim(bulk_body_template),'') = '';
