import geoip from 'geoip-lite';

/**
 * Parse user agent to detect device type
 */
export const detectDevice = (userAgent) => {
  const ua = userAgent.toLowerCase();
  
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    if (/ipad|tablet|kindle/i.test(ua)) {
      return 'Tablet';
    }
    return 'Mobile';
  }
  
  return 'Desktop';
};

/**
 * Parse user agent to detect browser
 */
export const detectBrowser = (userAgent) => {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('opera') || ua.includes('opr/')) return 'Opera';
  if (ua.includes('trident') || ua.includes('msie')) return 'Internet Explorer';
  
  return 'Unknown';
};

/**
 * Parse user agent to detect OS
 */
export const detectOS = (userAgent) => {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  
  return 'Unknown';
};

/**
 * Get location from IP address using geoip-lite
 */
export const getLocationFromIP = (ipAddress) => {
  // Skip localhost IPs
  if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.')) {
    return {
      city: 'Local',
      region: 'Development',
      country: 'Local',
      timezone: 'Local',
      coordinates: { lat: null, lng: null }
    };
  }
  
  const geo = geoip.lookup(ipAddress);
  
  if (!geo) {
    return {
      city: 'Unknown',
      region: 'Unknown',
      country: 'Unknown',
      timezone: 'Unknown',
      coordinates: { lat: null, lng: null }
    };
  }
  
  return {
    city: geo.city || 'Unknown',
    region: geo.region || 'Unknown',
    country: geo.country || 'Unknown',
    timezone: geo.timezone || 'Unknown',
    coordinates: {
      lat: geo.ll ? geo.ll[0] : null,
      lng: geo.ll ? geo.ll[1] : null
    }
  };
};

/**
 * Extract real IP from request (handles proxies)
 */
export const getRealIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
};

/**
 * Format location string for display
 */
export const formatLocation = (location) => {
  const parts = [];
  
  if (location.city && location.city !== 'Unknown') parts.push(location.city);
  if (location.region && location.region !== 'Unknown') parts.push(location.region);
  if (location.country && location.country !== 'Unknown') parts.push(location.country);
  
  return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
};
