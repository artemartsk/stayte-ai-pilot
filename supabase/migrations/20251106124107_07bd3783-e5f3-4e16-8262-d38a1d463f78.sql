-- Обновление текущего статуса контакта Emily Miller
UPDATE contacts 
SET current_status = 'qualified',
    current_deal_id = '022ba431-6c15-483b-bbe2-be70b9d59294',
    updated_at = NOW()
WHERE id = 'e0dbc5be-c0ee-4ea7-87cb-2c750fe43a94';