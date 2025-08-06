TYPE=VIEW
query=select `e`.`id` AS `evento_id`,`e`.`nombre` AS `evento_nombre`,count(distinct `p`.`id`) AS `total_participantes`,count(distinct `c`.`id`) AS `total_certificados`,count(distinct case when `c`.`tipo_archivo` = \'svg\' then `c`.`id` end) AS `certificados_svg`,count(distinct case when `c`.`tipo_archivo` = \'pdf\' then `c`.`id` end) AS `certificados_pdf`,count(distinct case when `c`.`tipo_archivo` = \'html\' then `c`.`id` end) AS `certificados_html`,count(distinct case when `c`.`id` is null then `p`.`id` end) AS `sin_certificado`,round(count(distinct `c`.`id`) / nullif(count(distinct `p`.`id`),0) * 100,2) AS `porcentaje_completado`,max(`c`.`fecha_generacion`) AS `ultimo_certificado_generado` from ((`certificados_idexud`.`eventos` `e` left join `certificados_idexud`.`participantes` `p` on(`e`.`id` = `p`.`evento_id`)) left join `certificados_idexud`.`certificados` `c` on(`p`.`id` = `c`.`participante_id`)) group by `e`.`id`,`e`.`nombre`
md5=c186c375379068dd4e562a8db3f04ce2
updatable=0
algorithm=0
definer_user=root
definer_host=localhost
suid=2
with_check_option=0
timestamp=0001749742410026939
create-version=2
source=SELECT \n    e.id as evento_id,\n    e.nombre as evento_nombre,\n    COUNT(DISTINCT p.id) as total_participantes,\n    COUNT(DISTINCT c.id) as total_certificados,\n    COUNT(DISTINCT CASE WHEN c.tipo_archivo = \'svg\' THEN c.id END) as certificados_svg,\n    COUNT(DISTINCT CASE WHEN c.tipo_archivo = \'pdf\' THEN c.id END) as certificados_pdf,\n    COUNT(DISTINCT CASE WHEN c.tipo_archivo = \'html\' THEN c.id END) as certificados_html,\n    COUNT(DISTINCT CASE WHEN c.id IS NULL THEN p.id END) as sin_certificado,\n    ROUND((COUNT(DISTINCT c.id) / NULLIF(COUNT(DISTINCT p.id), 0)) * 100, 2) as porcentaje_completado,\n    MAX(c.fecha_generacion) as ultimo_certificado_generado\nFROM eventos e\nLEFT JOIN participantes p ON e.id = p.evento_id\nLEFT JOIN certificados c ON p.id = c.participante_id\nGROUP BY e.id, e.nombre
client_cs_name=utf8mb4
connection_cl_name=utf8mb4_unicode_ci
view_body_utf8=select `e`.`id` AS `evento_id`,`e`.`nombre` AS `evento_nombre`,count(distinct `p`.`id`) AS `total_participantes`,count(distinct `c`.`id`) AS `total_certificados`,count(distinct case when `c`.`tipo_archivo` = \'svg\' then `c`.`id` end) AS `certificados_svg`,count(distinct case when `c`.`tipo_archivo` = \'pdf\' then `c`.`id` end) AS `certificados_pdf`,count(distinct case when `c`.`tipo_archivo` = \'html\' then `c`.`id` end) AS `certificados_html`,count(distinct case when `c`.`id` is null then `p`.`id` end) AS `sin_certificado`,round(count(distinct `c`.`id`) / nullif(count(distinct `p`.`id`),0) * 100,2) AS `porcentaje_completado`,max(`c`.`fecha_generacion`) AS `ultimo_certificado_generado` from ((`certificados_idexud`.`eventos` `e` left join `certificados_idexud`.`participantes` `p` on(`e`.`id` = `p`.`evento_id`)) left join `certificados_idexud`.`certificados` `c` on(`p`.`id` = `c`.`participante_id`)) group by `e`.`id`,`e`.`nombre`
mariadb-version=100432
