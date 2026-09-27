-- Run this AFTER 0005 has been committed.

update festivals
   set festival_type = 'note'
 where name ~* '^(ksaya|vriddhi) tithi'
    or name ~* '^(last day of|first day of).*caturmasya'
    or name ~* 'month of caturmasya begins';

select festival_type, count(*) from festivals group by 1 order by 2 desc;
