import dayjs from "dayjs";

export function checkSubscription(req, res, next) {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      status: false,
      pesan: "Unauthorized"
    });
  }

  if (!user.subscription_expires_at || dayjs(user.subscription_expires_at).isBefore(dayjs())) {
    return res.status(403).json({
      status: false,
      pesan: "Subscription tidak aktif. Silakan perpanjang API/subscription."
    });
  }

  next();
}
