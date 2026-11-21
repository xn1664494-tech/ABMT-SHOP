(function () {
  'use strict';

  // CSRF config
  const CSRF_META = 'csrf-token';
  const CSRF_HEADER = 'X-CSRF-Token';

  // Default timeout
  const DEFAULT_TIMEOUT = 15000;

  /** ApiError class */
  class ApiError extends Error {
    constructor(status, code, message, data, errors) {
      super(message);
      this.name = 'ApiError';
      this.status = status || 0;
      this.code = code || 'http';
      this.message = message;
      this.data = data;
      this.errors = errors;
    }
  }

  /** Core request function */
  function request(method, url, options = {}) {
    const {
      body,
      query,
      headers: extraHeaders,
      timeout,
      signal: originalSignal
    } = options;

    // Build URL with query params
    let requestUrl = url;
    if (query && typeof query === 'object') {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value != null && value !== undefined) {
          params.append(key, String(value));
        }
      });
      if (params.toString()) {
        const separator = requestUrl.includes('?') ? '&' : '?';
        requestUrl = `${requestUrl}${separator}${params.toString()}`;
      }
    }

    // AbortController for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout || DEFAULT_TIMEOUT);

    const fetchOptions = {
      method,
      credentials: 'same-origin',
      signal: abortController.signal,
      headers: {
        Accept: 'application/json',
        ...extraHeaders
      }
    };

    // Add CSRF header if not GET/HEAD
    if (!/^(GET|HEAD)$/i.test(method)) {
      // 1. Check cookie first (server uses csrfToken cookie)
      const cookieToken = document.cookie.match(/ csrfToken=([^;]+)/);
      if (cookieToken) {
        fetchOptions.headers['X-CSRF-Token'] = cookieToken[1];
      } else {
        // 2. Fall back to meta tag
        const metaTag = document.querySelector(`meta[name="${CSRF_META}"]`);
        if (metaTag) {
          fetchOptions.headers['X-CSRF-Token'] = metaTag.getAttribute('content') || '';
        }
        // If no meta tag, do NOT send header and do NOT error
      }
    }

    // Add body if provided
    if (body && typeof body === 'object') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }

    return fetch(requestUrl, fetchOptions)
      .then(response => {
        clearTimeout(timeoutId);
        const contentType = response.headers.get('content-type');

        // 204 No Content → null
        if (response.status === 204) {
          return null;
        }

        // Try to parse JSON if content-type indicates JSON
        let data;
        if (contentType && contentType.includes('application/json')) {
          data = response.json();
        } else {
          data = response.text();
        }

        // Success: return parsed data (or text if not JSON)
        return { response, data, isJson: contentType && contentType.includes('application/json') };
      })
      .then(({ response, data, isJson }) => {
        if (!response.ok) {
          clearTimeout(timeoutId);
          let message, code;

          // Try to extract message and errors from response data
          let errData = null;
          let errs = null;

          if (isJson && typeof data === 'object' && data !== null) {
            errData = data;
            // Keep errors field if present (ưu tiên errors, nếu không thì dùng details)
            if (errData.errors instanceof Object || Array.isArray(errData.errors)) {
              errs = errData.errors;
            } else if (Array.isArray(errData.details)) {
              errs = errData.details;
            }
            // Use message/error from server
            message = data.message || data.error;
          }

          // Determine status code and message
          const status = response.status;

          // Default messages by status
          const defaultMessages = {
            400: 'Yêu cầu không hợp lệ.',
            401: 'Vui lòng đăng nhập để tiếp tục.',
            403: 'Bạn không có quyền thực hiện thao tác này.',
            404: 'Không tìm thấy dữ liệu yêu cầu.',
            409: 'Dữ liệu đã thay đổi, vui lòng thử lại.',
            422: 'Thông tin chưa hợp lệ, vui lòng kiểm tra lại.',
            429: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
            500: 'Máy server đang gặp sự cố, vui lòng thử lại sau.',
            502: 'Máy server đang gặp sự cố, vui lòng thử lại sau.',
            503: 'Máy server đang gặp sự cố, vui lòng thử lại sau.'
          };

          if (message) {
            // Server provided message (could be Vietnamese)
            code = 'http';
          } else {
            code = 'http';
            message = defaultMessages[status] || 'Máy server đang gặp sự cố, vui lòng thử lại.';
          }

          throw new ApiError(
            status,
            code,
            message,
            errData,
            errs
          );
        }

        // Success
        clearTimeout(timeoutId);
        return isJson ? data : { text: data, ok: true };
      })
      .catch(err => {
        clearTimeout(timeoutId);
        // Network or timeout error
        if (err.name === 'AbortError') {
          throw new ApiError(0, 'timeout', 'Máy server phản hồi quá lâu, vui lòng thử lại.');
        }
        if (err instanceof ApiError) {
          throw err;
        }
        // Other fetch errors
        throw new ApiError(0, 'network', 'Không kết nối được tới máy chủ.');
      });
  }

  /** Utility methods */
  const api = {
    get(url, options = {}) {
      return request('GET', url, options);
    },
    post(url, body, options = {}) {
      return request('POST', url, { ...options, body });
    },
    put(url, body, options = {}) {
      return request('PUT', url, { ...options, body });
    },
    patch(url, body, options = {}) {
      return request('PATCH', url, { ...options, body });
    },
    delete(url, options = {}) {
      return request('DELETE', url, options);
    },
    /** Alias */
    del(url, options = {}) {
      return request('DELETE', url, options);
    },

    /** Optional callback on 401 */
    onUnauthorized(error) {
      // Default: do nothing; override if needed
    },
    ApiError
  };

  // Expose only window.ABMT, don't override existing
  if (window.ABMT === undefined) {
    window.ABMT = {};
  }
  window.ABMT.api = api;

})();