
WITH new_prices(bundle_size, size_gb, price, cost) AS (VALUES
  ('1GB',1,4.50,4.24),('2GB',2,8.60,8.18),('3GB',3,12.90,12.22),('4GB',4,17.20,16.16),
  ('5GB',5,21.50,20.30),('6GB',6,25.80,24.24),('7GB',7,30.10,28.28),('8GB',8,34.40,32.32),
  ('10GB',10,42.00,39.59),('15GB',15,64.00,59.09),('20GB',20,83.00,77.67),('25GB',25,104.00,97.97),
  ('30GB',30,124.50,117.16),('40GB',40,164.00,154.53),('50GB',50,205.00,199.98)
)
INSERT INTO public.custom_bundles (network_id, bundle_size, size_gb, agent_price, general_price, cost_price)
SELECT 'mtn', bundle_size, size_gb, price, price, cost FROM new_prices
ON CONFLICT (network_id, bundle_size) DO UPDATE SET
  size_gb = EXCLUDED.size_gb,
  agent_price = EXCLUDED.agent_price,
  general_price = EXCLUDED.general_price,
  cost_price = EXCLUDED.cost_price;
