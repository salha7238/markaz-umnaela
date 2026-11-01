import { TPL_MONTHLY_P1 } from './tpl_monthly_p1';
import { TPL_MONTHLY_P2 } from './tpl_monthly_p2';
import { TPL_FINAL_P1 } from './tpl_final_p1';
import { TPL_FINAL_P2 } from './tpl_final_p2';
import { TPL_STATS } from './tpl_stats';

export const TPL: { [key: string]: string } = {
  monthly: TPL_MONTHLY_P1 + TPL_MONTHLY_P2,
  final: TPL_FINAL_P1 + TPL_FINAL_P2,
  stats: TPL_STATS
};
